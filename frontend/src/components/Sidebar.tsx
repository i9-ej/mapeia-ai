"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Sidebar() {
    const pathname = usePathname();
    const isHome = pathname === "/";

    return (
        <aside className="sidebar">
            {/* Logo */}
            <div style={{
                padding: "24px 20px 20px",
                borderBottom: "1px solid var(--surface-border)"
            }}>
                <Link href="/" style={{ textDecoration: "none" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{
                            width: 36, height: 36,
                            background: "linear-gradient(135deg, #E87A2A, #D06B22)",
                            borderRadius: 10,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 16, flexShrink: 0, fontWeight: 800, color: "white"
                        }}>i9</div>
                        <div>
                            <div style={{ fontWeight: 800, fontSize: 16, color: "#1a202c", letterSpacing: "-0.3px" }}>
                                i9 Clinic
                            </div>
                            <div style={{ fontSize: 11, color: "#718096", fontWeight: 600 }}>
                                Consulting & Reports
                            </div>
                        </div>
                    </div>
                </Link>
            </div>

            {/* Navigation */}
            <nav style={{ padding: "16px 12px", flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#334155", letterSpacing: "1px", textTransform: "uppercase", padding: "4px 8px 8px" }}>
                    Menu
                </div>
                <Link
                    href="/"
                    style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "9px 12px", borderRadius: 10, marginBottom: 2,
                        textDecoration: "none",
                        background: isHome ? "rgba(232, 122, 42, 0.12)" : "transparent",
                        color: isHome ? "#D06B22" : "#64748b",
                        fontWeight: isHome ? 600 : 500,
                        fontSize: 14,
                        border: isHome ? "1px solid rgba(232, 122, 42, 0.2)" : "1px solid transparent",
                        transition: "all 0.15s"
                    }}
                >
                    <span style={{ fontSize: 16 }}>⊞</span>
                    Projetos
                </Link>
            </nav>

            {/* Footer with settings shortcut */}
            <div style={{
                padding: "12px 16px",
                borderTop: "1px solid var(--surface-border)",
            }}>
                <Link href="/settings" style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "8px 10px", borderRadius: 8,
                    textDecoration: "none",
                    color: pathname === "/settings" ? "#D06B22" : "#94a3b8",
                    background: pathname === "/settings" ? "rgba(232,122,42,0.08)" : "transparent",
                    fontSize: 12, fontWeight: 500,
                    transition: "all 0.15s",
                }}>
                    <span style={{ fontSize: 14 }}>⚙️</span>
                    API & Configurações
                </Link>
                <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 6, paddingLeft: 10 }}>
                    i9 Clinic · v1.0
                </div>
            </div>
        </aside>
    );
}
