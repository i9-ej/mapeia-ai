import { NextResponse } from "next/server";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const CLAUDE_BASE = "https://api.anthropic.com/v1/messages";

import https from "https";

function httpsPost(urlStr: string, headers: Record<string, string>, bodyObj: any): Promise<{ ok: boolean, status: number, json: () => Promise<any> }> {
    return new Promise((resolve, reject) => {
        const bodyStr = JSON.stringify(bodyObj);
        const u = new URL(urlStr);
        const req = https.request({
            hostname: u.hostname,
            port: u.port || 443,
            path: u.pathname + u.search,
            method: "POST",
            headers: { 
                ...headers, 
                "Content-Length": Buffer.byteLength(bodyStr),
                "Content-Type": "application/json"
            },
            family: 4 // Força IPv4 para resolver o bug de timeout do Node.js no Windows (IPv6 drop)
        }, (res) => {
            let data = "";
            res.on("data", chunk => data += chunk);
            res.on("end", () => {
                resolve({
                    ok: res.statusCode ? res.statusCode >= 200 && res.statusCode < 300 : false,
                    status: res.statusCode || 500,
                    json: async () => {
                        try { return JSON.parse(data); } catch { return { error: { message: "Invalid JSON response" } }; }
                    }
                });
            });
        });
        
        req.on("error", reject);
        req.write(bodyStr);
        req.end();
    });
}

export async function POST(req: Request) {
    try {
        const { provider, prompt, systemInstruction, apiKey, model } = await req.json();

        if (!apiKey) {
            return NextResponse.json({ error: "AI_KEY_MISSING" }, { status: 400 });
        }

        if (provider === "claude") {
            const body: Record<string, unknown> = {
                model,
                max_tokens: 8096,
                messages: [{ role: "user", content: prompt }],
            };
            if (systemInstruction) {
                body.system = systemInstruction;
            }

            const res = await httpsPost(CLAUDE_BASE, {
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
            }, body);

            if (!res.ok) {
                const err = await res.json();
                return NextResponse.json({ error: err?.error?.message || `HTTP ${res.status}` }, { status: res.status });
            }

            const data = await res.json();
            return NextResponse.json({ text: data?.content?.[0]?.text || "" });
        } else {
            // Gemini
            const body: Record<string, unknown> = {
                contents: [{ role: "user", parts: [{ text: prompt }] }],
            };
            if (systemInstruction) {
                body.system_instruction = { parts: [{ text: systemInstruction }] };
            }

            const res = await httpsPost(`${GEMINI_BASE}/${model}:generateContent?key=${apiKey}`, {}, body);

            if (!res.ok) {
                const err = await res.json();
                return NextResponse.json({ error: err?.error?.message || `HTTP ${res.status}` }, { status: res.status });
            }

            const data = await res.json();
            return NextResponse.json({ text: data?.candidates?.[0]?.content?.parts?.[0]?.text || "" });
        }
    } catch (e: unknown) {
        console.error("AI Proxy Error:", e);
        return NextResponse.json({ error: e instanceof Error ? e.message : "Internal Server Error" }, { status: 500 });
    }
}
