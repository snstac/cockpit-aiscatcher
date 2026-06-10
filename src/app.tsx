/*
 * SPDX-License-Identifier: Apache-2.0
 *
 * Cockpit AIS-catcher — service control, live statistics and vessels from a
 * local AIS-catcher instance (https://github.com/jvde-github/AIS-catcher).
 */

import React, { useEffect, useState } from 'react';
import { Alert } from "@patternfly/react-core/dist/esm/components/Alert/index.js";
import { Button } from "@patternfly/react-core/dist/esm/components/Button/index.js";
import { Card, CardBody, CardTitle } from "@patternfly/react-core/dist/esm/components/Card/index.js";
import { DescriptionList, DescriptionListGroup, DescriptionListTerm, DescriptionListDescription } from "@patternfly/react-core/dist/esm/components/DescriptionList/index.js";
import { Gallery } from "@patternfly/react-core/dist/esm/layouts/Gallery/index.js";
import { Flex, FlexItem } from "@patternfly/react-core/dist/esm/layouts/Flex/index.js";
import { Label } from "@patternfly/react-core/dist/esm/components/Label/index.js";

import cockpit from 'cockpit';

const _ = cockpit.gettext;
const SERVICE = "ais-catcher.service";
const AIS_PORT = 8100;

/* ---- data access ---- */

// AIS-catcher's web server runs on localhost:8100; fetch through the cockpit
// bridge (server-side) so there's no cross-origin / mixed-content problem.
function aisFetch(path: string): Promise<unknown> {
    return cockpit.http({ address: "127.0.0.1", port: AIS_PORT } as never)
            .get(path)
            .then((d: string) => JSON.parse(d));
}

function usePolled<T>(path: string, intervalMs: number, deps: { running: boolean }): T | null {
    const [data, setData] = useState<T | null>(null);
    useEffect(() => {
        if (!deps.running) {
            setData(null);
            return;
        }
        let alive = true;
        const tick = () => aisFetch(path)
                .then(d => { if (alive) setData(d as T); })
                .catch(() => { if (alive) setData(null); });
        tick();
        const id = window.setInterval(tick, intervalMs);
        return () => { alive = false; window.clearInterval(id); };
    }, [deps.running]);
    return data;
}

interface Service {
    state: string;            // active | inactive | failed | activating | unknown
    pending: boolean;
    error: string | null;
    act: (verb: string) => void;
    refresh: () => void;
}

function useService(): Service {
    const [state, setState] = useState("unknown");
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = () => cockpit
            .spawn(["sh", "-c", `systemctl is-active ${SERVICE} 2>/dev/null || true`])
            .then((o: string) => setState(o.trim() || "inactive"))
            .catch(() => setState("unknown"));

    useEffect(() => {
        refresh();
        const id = window.setInterval(refresh, 4000);
        return () => window.clearInterval(id);
    }, []);

    const act = (verb: string) => {
        setPending(true);
        setError(null);
        cockpit.spawn(["systemctl", verb, SERVICE], { superuser: "require", err: "message" })
                .then(() => refresh())
                .catch((e: { message?: string }) => setError(e?.message || `systemctl ${verb} failed`))
                .finally(() => { setPending(false); window.setTimeout(refresh, 800); });
    };

    return { state, pending, error, act, refresh };
}

/* ---- shapes ---- */

interface Stat {
    msg_rate?: number;
    vessel_count?: number;
    vessel_max?: number;
    received?: number;
    run_time?: number;
    station?: string;
    build_version?: string;
    tcp_clients?: number;
    sharing?: boolean;
    sharing_link?: string;
    product?: string;
    serial?: string;
    model?: string;
    sample_rate?: string;
    total?: { count?: number; dist?: number; channel?: number[]; msg?: number[] };
    last_minute?: { count?: number; vessels?: number };
    last_hour?: { count?: number; vessels?: number };
}

interface Ship {
    mmsi?: number;
    shipname?: string;
    shiptype?: number;
    shipclass?: string;
    country?: string;
    distance?: number;
    speed?: number;
    level?: number;
    last_signal?: number;
}

/* ---- helpers ---- */

const stripBr = (s?: string) => (s ?? "").replace(/<br\s*\/?>/gi, "").trim();
const num = (v: number | undefined, d = 0, unit = "") =>
    (v === undefined || v === null || Number.isNaN(v)) ? "—" : v.toFixed(d) + unit;

function duration(secs?: number): string {
    if (!secs && secs !== 0) return "—";
    const d = Math.floor(secs / 86400), h = Math.floor(secs % 86400 / 3600),
        m = Math.floor(secs % 3600 / 60), s = Math.floor(secs % 60);
    if (d) return `${d}d ${h}h ${m}m`;
    if (h) return `${h}h ${m}m`;
    if (m) return `${m}m ${s}s`;
    return `${s}s`;
}

function ago(last?: number): string {
    if (!last && last !== 0) return "—";
    // last_signal is seconds since the receiver started, or epoch — handle both.
    const now = Date.now() / 1000;
    let secs = last > 1e9 ? now - last : last;
    if (secs < 0) secs = 0;
    if (secs < 60) return `${Math.round(secs)}s`;
    if (secs < 3600) return `${Math.round(secs / 60)}m`;
    return `${Math.round(secs / 3600)}h`;
}

const Row = ({ term, children }: { term: string, children: React.ReactNode }) => (
    <DescriptionListGroup>
        <DescriptionListTerm>{term}</DescriptionListTerm>
        <DescriptionListDescription>{children}</DescriptionListDescription>
    </DescriptionListGroup>
);

/* ---- cards ---- */

const ServiceBar = ({ svc, stat }: { svc: Service, stat: Stat | null }) => {
    const host = window.location.hostname;
    const active = svc.state === "active";
    const color = active ? "green" : svc.state === "failed" ? "red" : "grey";
    return (
        <Card>
            <CardBody>
                <Flex alignItems={{ default: "alignItemsCenter" }} spaceItems={{ default: "spaceItemsMd" }}>
                    <FlexItem><Label color={color as "green" | "red" | "grey"}>{svc.state}</Label></FlexItem>
                    <FlexItem>
                        <b>AIS-catcher</b>{stat?.build_version ? ` ${stat.build_version}` : ""}
                        {stat?.station ? ` · ${stat.station}` : ""}
                        {stat?.run_time !== undefined ? ` · up ${duration(stat.run_time)}` : ""}
                    </FlexItem>
                    <FlexItem flex={{ default: "flex_1" }} />
                    <FlexItem>
                        <Button variant="secondary" isDisabled={svc.pending || active} onClick={() => svc.act("start")}>{_("Start")}</Button>{" "}
                        <Button variant="secondary" isDisabled={svc.pending || !active} onClick={() => svc.act("restart")}>{_("Restart")}</Button>{" "}
                        <Button variant="secondary" isDisabled={svc.pending || !active} onClick={() => svc.act("stop")}>{_("Stop")}</Button>{" "}
                        <Button component="a" variant="primary" href={`http://${host}:${AIS_PORT}/`} target="_blank" rel="noopener noreferrer">{_("Open map ↗")}</Button>
                    </FlexItem>
                </Flex>
                {svc.error && <Alert variant="danger" isInline isPlain title={svc.error} style={{ marginBlockStart: "8px" }} />}
            </CardBody>
        </Card>
    );
};

const StatCards = ({ stat }: { stat: Stat | null }) => {
    const ch = stat?.total?.channel ?? [];
    return (
        <Gallery hasGutter minWidths={{ default: "230px" }}>
            <Card>
                <CardTitle>{_("Throughput")}</CardTitle>
                <CardBody>
                    <DescriptionList isHorizontal>
                        <Row term={_("Messages")}>{num(stat?.received)}</Row>
                        <Row term={_("Rate")}>{num(stat?.msg_rate, 1, _(" msg/s"))}</Row>
                        <Row term={_("Last minute")}>{num(stat?.last_minute?.count)}</Row>
                    </DescriptionList>
                </CardBody>
            </Card>
            <Card>
                <CardTitle>{_("Vessels")}</CardTitle>
                <CardBody>
                    <DescriptionList isHorizontal>
                        <Row term={_("Tracked")}>{num(stat?.vessel_count)}{stat?.vessel_max ? ` / ${stat.vessel_max}` : ""}</Row>
                        <Row term={_("New last hour")}>{num(stat?.last_hour?.vessels)}</Row>
                        <Row term={_("Max range")}>{num(stat?.total?.dist, 1, _(" NM"))}</Row>
                    </DescriptionList>
                </CardBody>
            </Card>
            <Card>
                <CardTitle>{_("Channels")}</CardTitle>
                <CardBody>
                    <DescriptionList isHorizontal>
                        <Row term="A (161.975)">{num(ch[0])}</Row>
                        <Row term="B (162.025)">{num(ch[1])}</Row>
                        <Row term={_("Feed clients")}>{num(stat?.tcp_clients)}</Row>
                    </DescriptionList>
                </CardBody>
            </Card>
            <Card>
                <CardTitle>{_("Input")}</CardTitle>
                <CardBody>
                    <DescriptionList isHorizontal>
                        <Row term={_("Source")}>{stripBr(stat?.product) || "—"}</Row>
                        <Row term={_("Model")}>{stripBr(stat?.model) || "—"}</Row>
                        <Row term={_("Rate")}>{stripBr(stat?.sample_rate) || "—"}</Row>
                        <Row term={_("Device")}><span className="ais-dev">{(stripBr(stat?.serial) || "—").replace(/^.*\//, "")}</span></Row>
                    </DescriptionList>
                </CardBody>
            </Card>
        </Gallery>
    );
};

const VesselTable = ({ ships }: { ships: Ship[] }) => {
    const sorted = ships.slice()
            .filter(s => s.distance !== undefined)
            .sort((a, b) => (a.distance ?? 1e9) - (b.distance ?? 1e9))
            .slice(0, 100);
    const noPos = ships.length - sorted.length;
    return (
        <Card>
            <CardTitle>{cockpit.format(_("Vessels ($0)"), ships.length)}</CardTitle>
            <CardBody>
                {sorted.length === 0
                    ? <span className="ais-sub">{_("No vessels with a position yet.")}</span>
                    : (
                        <table className="ais-table">
                            <thead>
                                <tr>
                                    <th>{_("MMSI")}</th><th>{_("Name")}</th><th>{_("Type")}</th>
                                    <th>{_("Country")}</th><th>{_("Dist (NM)")}</th><th>{_("Speed (kn)")}</th>
                                    <th>{_("Signal (dB)")}</th><th>{_("Last")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sorted.map(s => (
                                    <tr key={s.mmsi}>
                                        <td>{s.mmsi ?? "—"}</td>
                                        <td>{(s.shipname || "").trim() || <span className="ais-sub">—</span>}</td>
                                        <td>{s.shipclass || (s.shiptype ? String(s.shiptype) : "—")}</td>
                                        <td>{s.country || "—"}</td>
                                        <td>{num(s.distance, 1)}</td>
                                        <td>{s.speed !== undefined && s.speed >= 0 ? num(s.speed, 1) : "—"}</td>
                                        <td>{num(s.level, 0)}</td>
                                        <td>{ago(s.last_signal)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                {noPos > 0 && <div className="ais-sub" style={{ marginBlockStart: "6px" }}>{cockpit.format(_("+ $0 without a position"), noPos)}</div>}
            </CardBody>
        </Card>
    );
};

export const Application = () => {
    const svc = useService();
    const running = svc.state === "active";
    const stat = usePolled<Stat>("/stat.json", 3000, { running });
    const shipsDoc = usePolled<{ ships?: Ship[] }>("/ships.json", 5000, { running });
    const ships = shipsDoc?.ships ?? [];

    return (
        <div className="ais-page">
            <Flex direction={{ default: "column" }} spaceItems={{ default: "spaceItemsLg" }}>
                <FlexItem><ServiceBar svc={svc} stat={stat} /></FlexItem>
                {!running && (
                    <FlexItem>
                        <Alert variant={svc.state === "failed" ? "danger" : "info"} isInline
                            title={svc.state === "failed"
                                ? _("ais-catcher.service has failed — check the journal")
                                : _("AIS-catcher is not running. Start it to see live data.")} />
                    </FlexItem>
                )}
                {running && (
                    <>
                        <FlexItem><StatCards stat={stat} /></FlexItem>
                        <FlexItem><VesselTable ships={ships} /></FlexItem>
                        {stat?.sharing && stat.sharing_link && (
                            <FlexItem>
                                <span className="ais-sub">
                                    {_("Sharing to community: ")}
                                    <a href={stat.sharing_link} target="_blank" rel="noopener noreferrer">{_("view on aiscatcher.org ↗")}</a>
                                </span>
                            </FlexItem>
                        )}
                    </>
                )}
            </Flex>
        </div>
    );
};
