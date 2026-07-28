# 《守株待兔》生产摩擦处置结论（dev.1）

日期：2026-07-28
来源：外部生产工作区 `shou-zhu-dai-tu-film` 的
`skill-friction-log.md` F001–F061
原则：先阻断错误影片和错误交付，再减少审批/付费返工，最后改善操作体验；
不把项目创作错误、Agent 操作错误或宿主限制伪装成 Skill/runtime 根因。

## 审计结论

本次 61 条记录不是 61 个互相独立的仓库缺陷。它们可归并为四类：

| 优先级 | 风险簇 | 对应记录 | 处置 |
|---|---|---|---|
| P0 | 未完成工作项可被预览、审批和最终交付绕过 | F061 | 本批修复：只有当前 `assets-ready` seal 可以自动结清已验证的导演同步项；任何其他未完成项或 blocked 项阻断 assets-ready，预览审批和两种渲染都拒绝未完成工作项。 |
| 已关闭 | 接地、载体、遮挡、静止与因果连续性只验证结构，不能保证观众看到正确画面 | F044–F054、F056–F057 的确定性部分 | `spatialContracts[]` 已把 support surface、接触锚点、遮挡拓扑、同世界连续性、持续步态和 locked-contact 不变量提升为 authoring/schema/runtime/proof/quality 一等合同；像素无法可靠判断的创作语义仍保留人工组合审核。 |
| 已关闭 | 证明可能来自旧图，透明碎片/硬矩形派生边界可能漏检 | F038、F040、F054 的确定性部分 | schema-v3 scaffold 绑定当前 composite fingerprint 与每个证据 SHA；alpha topology 补充 detached fragment 和 derivation-bound hard rectangle 检测。F010 的 fixture 命令也拒绝项目参数并指向项目证明命令。 |
| 已关闭 | 音频预检表面与最终 Remotion 混音表面不一致，失败发现过晚 | F042–F043 | 预检实际编码/检测 96k 与 192k AAC；新渲染和音频-only 刷新都 codec-copy 同一已检音轨。 |
| P1 | 计划、provider、预算与概念审批合同存在漂移或回退路径缺失 | F001–F003、F006、F008 | 统一 source/package 编译路径和 provider 身份；将画布能力、调用数、上限/成本及回退方案纳入一次可审计确认。 |
| P1 | 注册素材派生、分格、色键和重新登记的局部成功不能保证语义有效 | F009、F013、F015、F018–F019、F023–F024、F040、F045、F054 | provider 请求、处理器、family fingerprint、绑定和技术/视觉证明采用同一注册族合同；优先完整表内定向修复，不接受孤立替换格。 |
| 部分关闭 | 导演和剪辑语义没有完整的一等 authoring 入口 | F005、F012、F016、F029–F036、F050–F051、F056–F057 | F034–F036 已关闭：离散音效改用 `soundCue` 且旁白只属于 `scene.narration`；镜头 treatment 只接受 `scene-camera`；节点位移改为 `offsetX/offsetY`，不再与绝对布局或 camera 坐标同名。其余保持独立条目。 |
| 部分关闭 | 修订后的质量缓存、证明失效范围和命令时序不可靠 | F011、F021–F024、F038–F039、F041、F055 | F038/F055 已关闭：证明逐文件绑定哈希，render 在 sync/audio/quality 前先检查生产 seal/工作项；其余保持独立条目。 |
| 已关闭 | 字幕字体、句界分段和字幕专用质量失效范围 | F058–F060 | 已由 `e3c64e4`、`5c77a0f` 及相应测试/packaged plugin 验证；后续只在复现时重开。 |
| 已关闭 | CLI 可发现性和重复操作提示 | F017、F025、F037 | 相同尝试关闭可幂等重试；`project:quality --help` 不创建 metrics/项目副作用；样式证明统一为 `project:style-proof`，移除不一致的旧别名。 |
| 外部边界 | Codex Default UI、ChatCut/浏览器下载和大输出行为 | F004、F007、F026–F028 | 仓库内不伪造宿主能力；保留文本 fallback、落盘 provenance、错误边界和恢复说明。 |
| Agent/项目边界 | 相对临时脚本路径、重复前景节点等手工操作错误 | F020、F047 | 不为一次性路径或节点堆叠增加兼容分支；canonical 命令和通用校验应尽早拒绝其错误结果。 |

同一条记录出现在相邻风险簇时不是重复计数。例如 F052 同时暴露空间合同
缺失和证明不可信；F054 同时暴露派生策略与证明表面缺陷。正式修复必须按
纵向能力闭环，而不是按 F 编号逐条打补丁。

## 当前批次：关闭 F061

根因位于通用生产状态机：导演修订会创建
`directing-revision-<sceneId>` 工作项，但 assets-ready、预览审批和渲染此前
都没有统一消费或检查这些工作项。因此生产项目可以在 `complete` 阶段仍
报告 pending 同步任务。

修复合同：

1. `project:assets-ready` 在所有现有校验和 seal 成功后，原子结清
   pending/in-progress 的导演同步项并写入可审计 history。
2. unrelated pending/in-progress 项以及所有 blocked 项阻断 assets-ready。
3. `approve-preview`、preview render 和 final render 拒绝任何未完成工作项。
4. Skill、project contract、execution control、测试与 packaged plugin 使用
   相同语义。

验收不以《守株待兔》状态文件手工变绿为准，而以通用状态机测试、完整检查、
packaged-plugin 同步及新安装缓存验证为准。

## `.agent-tmp/` 处置

仓库中的 `.agent-tmp/` 共 61 个文件，约 1.6 MB：

- 24 个一次性 `.mjs` 修复/生成脚本；
- 31 个项目 JSON、provider 请求和质量审查快照；
- 5 个 SVG 纸艺 motif；
- 1 份摩擦日志副本。

其中 51 个文件直接绑定 `shou-zhu-dai-tu` 或其外部绝对路径，仓库没有任何
tracked 文件引用该目录。5 个 SVG 与外部生产工作区中的权威副本 SHA-256
完全一致。因此它们不应进入 reusable Skill、测试 fixture 或 Git 历史。

最终处置是：

1. 将 `.agent-tmp/` 加入 `.gitignore`，防止误提交；
2. 审计完成并获得用户确认后，已删除整个目录；
3. 可复用能力只通过正式 schema、runtime、validator、proof、测试和文档进入
   仓库，不保留项目专用脚本。

## 本批后仍保留的边界

本批只关闭有确定仓库根因和可执行验收面的条目。F045/F050 的剩余人工语义
判断，以及 Default UI、ChatCut/浏览器下载等外部
能力没有被伪装成修复。任何仅靠像素无法判断的“这块麦田在语义上不该出现”
仍由绑定当前证明的组合审核负责；确定性的浮空、接地、连续性、透明残片和硬
裁切则由现有合同/技术门直接阻断。
