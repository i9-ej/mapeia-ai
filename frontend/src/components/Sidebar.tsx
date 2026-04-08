"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
    { href: "/", label: "Dashboard", icon: "⊞" },
    { href: "/knowledge", label: "Base de Conhecimento", icon: "🧠" },
    { href: "/settings", label: "Configurações", icon: "⚙️" },
];

export function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="sidebar">
            {/* Logo */}
            <div style={{
                padding: "24px 20px 20px",
                borderBottom: "1px solid var(--surface-border)"
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                        width: 36, height: 36,
                        background: "linear-gradient(135deg, #6172f3, #a78bfa)",
                        borderRadius: 10,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 18, flexShrink: 0
                    }}>⚕</div>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: "#f1f5f9", letterSpacing: "-0.3px" }}>
                            ClinicFlow
                        </div>
                        <div style={{ fontSize: 11, color: "#475569", fontWeight: 500 }}>
                            Architect
                        </div>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav style={{ padding: "16px 12px", flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#334155", letterSpacing: "1px", textTransform: "uppercase", padding: "4px 8px 8px" }}>
                    Menu
                </div>
                {navItems.map((item) => {
                    const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            style={{
                                display: "flex", alignItems: "center", gap: 10,
                                padding: "9px 12px", borderRadius: 10, marginBottom: 2,
                                textDecoration: "none",
                                background: isActive ? "rgba(97,114,243,0.12)" : "transparent",
                                color: isActive ? "#818cf8" : "#64748b",
                                fontWeight: isActive ? 600 : 400,
                                fontSize: 14,
                                border: isActive ? "1px solid rgba(97,114,243,0.2)" : "1px solid transparent",
                                transition: "all 0.15s"
                            }}
                        >
                            <span style={{ fontSize: 16 }}>{item.icon}</span>
                            {item.label}
                        </Link>
                    );
                })}
            </nav>

            {/* Footer */}
            <div style={{
                padding: "16px 20px",
                borderTop: "1px solid var(--surface-border)",
                fontSize: 11,
                color: "#334155"
            }}>
                <div style={{ fontWeight: 600, color: "#475569", marginBottom: 2 }}>ClinicFlow Architect</div>
                <div>Gemini 2.0 Flash · v1.0</div>
            </div>
        </aside>
    );
}
