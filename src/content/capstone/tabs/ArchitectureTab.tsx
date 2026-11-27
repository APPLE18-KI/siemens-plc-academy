import React, { useMemo, useState } from 'react';
import { Cpu, Network, Package, Search, Server, TableProperties } from 'lucide-react';
import { HARDWARE_BOM, PROFINET_NODES, STATION_IO_TABLE } from '../data/projectData';
import { Telegram1Workbench } from '../components/Telegram1Workbench';

/**
 * Orthogonal rounded-elbow PROFINET cable routes from SCALANCE XB008 (center 360,150, box 292..428 x 126..174)
 * to each device node, following diagram-design §6 (orthogonal only, fanned attach points >=12px apart, no transit behind boxes).
 */
const TOPO_ORTHO_PATHS: Record<string, { d: string; portX: number; portY: number; dashed?: boolean }> = {
  plc: {
    d: 'M 360 126 L 360 86',
    portX: 360,
    portY: 106,
  },
  hmi: {
    d: 'M 292 150 L 244 150 Q 236 150 236 158 L 236 186 Q 236 194 228 194 L 180 194',
    portX: 236,
    portY: 172,
    dashed: true,
  },
  et200sp: {
    d: 'M 428 140 L 488 140 Q 496 140 496 132 L 496 82 Q 496 74 504 74 L 565 74',
    portX: 496,
    portY: 108,
  },
  vision: {
    d: 'M 428 160 L 496 160 Q 504 160 504 168 L 504 186 Q 504 194 512 194 L 580 194',
    portX: 504,
    portY: 176,
  },
  g120: {
    d: 'M 332 174 L 332 204 Q 332 212 324 212 L 247 212 Q 239 212 239 220 L 239 248',
    portX: 286,
    portY: 212,
  },
  v90x: {
    d: 'M 360 174 L 360 218 Q 360 224 366 224 L 373 224 Q 379 224 379 230 L 379 248',
    portX: 369,
    portY: 224,
  },
  v90z: {
    d: 'M 388 174 L 388 204 Q 388 212 396 212 L 511 212 Q 519 212 519 220 L 519 248',
    portX: 454,
    portY: 212,
  },
};

export const ArchitectureTab: React.FC = () => {
  const [selectedNodeId, setSelectedNodeId] = useState<string>('plc');
  const [ioFilterArea, setIoFilterArea] = useState<string>('ALL');
  const [ioSearch, setIoSearch] = useState<string>('');

  const selectedNode =
    PROFINET_NODES.find((n) => n.id === selectedNodeId) ?? PROFINET_NODES[0];

  const totalBomCny = useMemo(
    () => HARDWARE_BOM.reduce((sum, item) => sum + item.qty * item.unitPriceCny, 0),
    []
  );

  const filteredIo = useMemo(() => {
    const q = ioSearch.trim().toLowerCase();
    return STATION_IO_TABLE.filter((row) => {
      const areaMatch = ioFilterArea === 'ALL' || row.area === ioFilterArea;
      const textMatch =
        !q ||
        row.symbol.toLowerCase().includes(q) ||
        row.address.toLowerCase().includes(q) ||
        row.comment.toLowerCase().includes(q) ||
        row.module.toLowerCase().includes(q);
      return areaMatch && textMatch;
    });
  }, [ioFilterArea, ioSearch]);

  const switchCenter = { x: 360, y: 150 };

  return (
    <div>
      {/* 1. Interactive PROFINET Network Topology */}
      <section className="cap-panel">
        <div className="cap-panel-head">
          <h2 className="cap-panel-title">
            <Network size={18} color="#14b8a6" /> PROFINET IO (RT) 工业实时网络拓扑（点击任意节点查看订货号与报文）
          </h2>
          <span className="cap-badge teal">子网: 192.168.0.0/24 · SCALANCE XB008 星型交换</span>
        </div>

        <div className="cap-topo-grid">
          <div className="cap-svg-stage">
            <svg
              role="img"
              aria-labelledby="profinet-topo-title profinet-topo-desc"
              viewBox="0 0 720 330"
              width="100%"
              style={{ display: 'block', minWidth: 560 }}
            >
              <title id="profinet-topo-title">SIMATIC S7-1215C PROFINET IO 星型实时网络拓扑</title>
              <desc id="profinet-topo-desc">
                展示 S7-1215C 主站经由 SCALANCE XB008 工业交换机连接 TP700 HMI、G120 变频器、V90 X/Z 伺服、智能视觉相机和 ET200SP 远程 IO 的星型组网结构。
              </desc>
              {/* Subnet backdrop */}
              <rect
                x="12"
                y="12"
                width="696"
                height="306"
                rx="8"
                fill="rgba(0,153,153,0.04)"
                stroke="rgba(0,153,153,0.24)"
                strokeDasharray="6 4"
              />
              <text
                x="24"
                y="32"
                fill="#94a3b8"
                fontSize="11"
                fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif"
              >
                PROFINET IO System · 100Mbps Full-Duplex · Send Clock 2.0ms
              </text>

              {/* Orthogonal Ethernet routes from SCALANCE XB008 (drawn before boxes) */}
              {PROFINET_NODES.map((node) => {
                const route = TOPO_ORTHO_PATHS[node.id];
                const isSel = node.id === selectedNode.id;
                if (!route) return null;
                return (
                  <g key={`link-${node.id}`}>
                    <path
                      d={route.d}
                      fill="none"
                      stroke={isSel ? node.accent : '#3b4d63'}
                      strokeWidth={isSel ? 2.6 : 1.6}
                      strokeDasharray={route.dashed ? '5 4' : undefined}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <circle
                      cx={route.portX}
                      cy={route.portY}
                      r={isSel ? 4 : 3}
                      fill={isSel ? node.accent : '#64748b'}
                    />
                  </g>
                );
              })}

              {/* Center Industrial Switch */}
              <g>
                <rect
                  x={switchCenter.x - 68}
                  y={switchCenter.y - 24}
                  width={136}
                  height={48}
                  rx={6}
                  fill="#0f172a"
                  stroke="#009999"
                  strokeWidth={2}
                />
                <text x={switchCenter.x} y={switchCenter.y - 3} textAnchor="middle" fill="#14d4d4" fontSize="11.5" fontWeight="700">
                  SCALANCE XB008
                </text>
                <text
                  x={switchCenter.x}
                  y={switchCenter.y + 13}
                  textAnchor="middle"
                  fill="#94a3b8"
                  fontSize="11"
                  fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif"
                >
                  8-Port PN Switch
                </text>
              </g>

              {/* Interactive Device Nodes */}
              {PROFINET_NODES.map((node) => {
                const isSel = node.id === selectedNode.id;
                return (
                  <g
                    key={node.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedNodeId(node.id)}
                  >
                    <rect
                      x={node.x}
                      y={node.y}
                      width={128}
                      height={60}
                      rx={6}
                      fill={isSel ? 'rgba(0,153,153,0.22)' : '#111821'}
                      stroke={isSel ? node.accent : '#334155'}
                      strokeWidth={isSel ? 2.2 : 1.2}
                    />
                    <rect x={node.x + 8} y={node.y + 11} width={6} height={10} rx={2} fill={node.accent} />
                    <text x={node.x + 20} y={node.y + 20} fill="#f8fafc" fontSize="11.5" fontWeight="700">
                      {node.label}
                    </text>
                    <text
                      x={node.x + 10}
                      y={node.y + 38}
                      fill={node.accent}
                      fontSize="10.5"
                      fontWeight="700"
                      fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif"
                    >
                      {node.ip}
                    </text>
                    <text
                      x={node.x + 10}
                      y={node.y + 52}
                      fill="#94a3b8"
                      fontSize="10.5"
                      fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif"
                    >
                      {node.pnName}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Selected Node Inspector */}
          <div className="cap-node-detail">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span className="cap-badge teal">
                <Server size={12} /> {selectedNode.ip}
              </span>
              <span className="cap-mono" style={{ fontSize: 11.5, color: 'var(--cap-text-muted)' }}>
                {selectedNode.pnName}
              </span>
            </div>
            <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>{selectedNode.model}</h3>
            <div style={{ fontSize: 12.5, color: 'var(--cap-teal-bright)', fontWeight: 600, marginBottom: 12 }}>
              {selectedNode.role}
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr',
                gap: 7,
                padding: 10,
                borderRadius: 9,
                background: 'var(--cap-panel)',
                border: '1px solid var(--cap-border)',
                fontSize: 12,
                marginBottom: 12,
              }}
            >
              <div>
                <span style={{ color: 'var(--cap-text-muted)' }}>西门子订货号：</span>
                <strong className="cap-mono">{selectedNode.orderNumber}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--cap-text-muted)' }}>通信与报文：</span>
                <strong>{selectedNode.telegram}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--cap-text-muted)' }}>逻辑地址映射：</span>
                <strong className="cap-mono" style={{ color: '#38bdf8' }}>
                  {selectedNode.ioRange}
                </strong>
              </div>
            </div>

            <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>工程配置与面试亮点：</div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, lineHeight: 1.65, color: 'var(--cap-text-muted)' }}>
              {selectedNode.highlights.map((h, i) => (
                <li key={i} style={{ marginBottom: 4 }}>
                  {h}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* 2. Interactive PROFINET Standard Telegram 1 Bit-Level Workbench */}
      <Telegram1Workbench />

      {/* 3. Hardware BOM Table */}
      <section className="cap-panel">
        <div className="cap-panel-head">
          <h2 className="cap-panel-title">
            <Package size={18} color="#14b8a6" /> 整站电控硬件选型 BOM 表（含选型依据与预算估算）
          </h2>
          <span className="cap-badge green">
            核心电控参考总价：¥{totalBomCny.toLocaleString()} 元（10 类主件）
          </span>
        </div>

        <div className="cap-table-wrap">
          <table className="cap-table">
            <thead>
              <tr>
                <th>#</th>
                <th>分类</th>
                <th>型号名称</th>
                <th>西门子订货号 / 规格码</th>
                <th>数量</th>
                <th>关键电气参数</th>
                <th>参考单价</th>
                <th>选型工程理由</th>
              </tr>
            </thead>
            <tbody>
              {HARDWARE_BOM.map((item) => (
                <tr key={item.no}>
                  <td className="cap-mono">{item.no}</td>
                  <td>
                    <span className="cap-badge teal">{item.category}</span>
                  </td>
                  <td style={{ fontWeight: 700 }}>{item.name}</td>
                  <td className="cap-mono" style={{ color: '#38bdf8', whiteSpace: 'nowrap' }}>
                    {item.orderNumber}
                  </td>
                  <td className="cap-mono">{item.qty}</td>
                  <td>{item.spec}</td>
                  <td className="cap-mono" style={{ whiteSpace: 'nowrap' }}>
                    ¥{item.unitPriceCny.toLocaleString()}
                  </td>
                  <td style={{ color: 'var(--cap-text-muted)' }}>{item.rationale}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 3. Filterable Standard I/O Table */}
      <section className="cap-panel">
        <div className="cap-panel-head">
          <h2 className="cap-panel-title">
            <TableProperties size={18} color="#14b8a6" /> 标准 I/O 地址分配总表（与 TIA Portal CSV 100% 一致）
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            {(['ALL', 'I', 'Q', 'AI', 'PN-I', 'PN-Q'] as const).map((area) => (
              <button
                key={area}
                type="button"
                className={`cap-btn ${ioFilterArea === area ? 'primary' : ''}`}
                style={{ padding: '4px 10px', fontSize: 11.5 }}
                onClick={() => setIoFilterArea(area)}
              >
                {area === 'ALL' ? '全部点位' : area}
              </button>
            ))}
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
              <Search size={14} style={{ position: 'absolute', left: 9, color: '#94a3b8' }} />
              <input
                type="text"
                className="cap-input"
                style={{ paddingLeft: 28, width: 190 }}
                placeholder="搜符号 / 地址 / 注释..."
                value={ioSearch}
                onChange={(e) => setIoSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="cap-table-wrap">
          <table className="cap-table">
            <thead>
              <tr>
                <th>符号变量名 (TIA Symbol)</th>
                <th>标准逻辑地址</th>
                <th>分区</th>
                <th>数据类型</th>
                <th>硬件所属模块</th>
                <th>功能注释与安全极性说明</th>
              </tr>
            </thead>
            <tbody>
              {filteredIo.map((row) => (
                <tr key={`${row.symbol}-${row.address}`}>
                  <td className="cap-mono" style={{ fontWeight: 700 }}>
                    {row.symbol}
                  </td>
                  <td className="cap-mono" style={{ color: '#38bdf8', fontWeight: 700 }}>
                    {row.address}
                  </td>
                  <td>
                    <span
                      className={`cap-badge ${
                        row.area === 'I'
                          ? 'blue'
                          : row.area === 'Q'
                            ? 'green'
                            : row.area === 'AI'
                              ? 'amber'
                              : 'teal'
                      }`}
                    >
                      {row.area}
                    </span>
                  </td>
                  <td className="cap-mono">{row.dataType}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <Cpu size={12} style={{ verticalAlign: '-2px', marginRight: 5 }} />
                    {row.module}
                  </td>
                  <td style={{ color: 'var(--cap-text-muted)' }}>{row.comment}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
