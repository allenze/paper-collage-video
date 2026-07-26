# 《龟兔赛跑》生产摩擦处置结论（dev.22）

日期：2026-07-27
来源：`skill-friction-log.md` 的 F001–F101 实际生产记录
原则：以最终画面、语义、身份、审计和付费边界为优先；不把宿主限制或操作失误伪装成 Skill 根因。

## 本批必须关闭的高优先级问题

| 风险面 | 对应记录 | dev.22 的统一处置 |
|---|---|---|
| 关键动作在 scenario 中只计数、不落到真实镜头 | F006 | `commonStory.semanticActions` 与每个 option 的 `semanticActionCoverage` 必须路由到实际 registered state、local motion 或 layer package；编译器解析场景和目标后才计为覆盖。 |
| 状态注册、身份和逐状态朝向不可证 | F024、F035、F086、F096 | state sheet、provider request、runtime state 全部声明逐状态 anchors/facing/identity reference；处理器产生锚点叠加证据，质量门核对漂移、证据哈希和 active identity SHA。 |
| 世界条带矩形合法但真实像素不可用 | F062、F063、F071、F090、F098 | 每条 strip 声明可见 surface role；proof 读取真实 alpha，验证整宽可见面、ground 两端真实支撑、带符号位移和可见接地，不再以矩形 transform 或无符号距离代替。 |
| 单主体模型破坏多角色遮挡和世界锚定 | F070、F087、F091、F097 | `subjectBindings` 支持唯一 tracked subject 与多个 participant；每个角色显式选择 screen/world anchor 和 near-layer 遮挡关系，运行时共享 ground displacement。 |
| 人工语义修订无正式入口，静态镜头被档位计数反向污染 | F056、F067、F069、F083、F084 | 新增 human-authorized semantic revision；只允许授权场景变化，记录概念指纹差异并全量失效下游证据。`locked-static` 只重算 motion/parallax/ambient 场景下限，不降低状态族、层、调用和关键动作承诺。 |

这些问题不能忽略：它们会让“结构通过”与观众实际看到的动作、方向、接地、身份或遮挡相矛盾。

## 可以不在仓库内继续修复

以下问题可以从 Skill backlog 关闭为“外部/操作边界”，不是因为它们不存在，而是仓库无法提供根因修复；保留现有明确错误、恢复流程和审计即可。

| 分类 | 对应记录 | 结论 |
|---|---|---|
| Codex Default 模式没有宿主结构化问答工具 | F001 | 接受宿主能力差异；继续使用文本 fallback。不能由 Skill 模拟一个不存在的 host UI。 |
| 明确记录为操作者命令或并发写入错误 | F010、F019 | 不增加兼容分支；依靠 canonical command、原子写入和现有校验暴露错误。 |
| ChatCut/浏览器下载与本地拉取能力缺失 | F011、F052、F053、F088 | 归属 connector/browser host；Skill 只接受落到 workspace 且有 provenance 的文件，不承诺外部连接器能力。 |
| Host 图片调用网络失败后的 reservation closure | F015、F033 | 网络根因在 host；attempt ledger 与人工 closure 是正确的审计边界，不把失败伪报为未消费。 |
| Chromium 在受限沙箱中的 Mach-port/启动权限 | F022、F060 | 归属运行环境；保留受控浏览器路径、低并发和明确的权限错误。仓库内绕过沙箱不是合法修复。 |

这些项可“忽略继续开发”，但发生时仍应如实报告，不能宣称宿主能力已修好。

## 当前可以延期，但不应永久忽略

这些问题不会在已有确定性质量门全部通过时直接改变像素正确性，适合作为 P2 体验与可维护性 backlog；若开始频繁返工或形成错误批准，应立即升级。

| 主题 | 对应记录 | 延期理由与升级条件 |
|---|---|---|
| CLI 帮助、输出透传和错误可发现性 | F005、F008、F014、F018、F026、F027、F065、F092 | 当前可由退出码、JSON 文件和 canonical 示例验证。若再次造成错误项目写入或重复消费，升级为 P1。F059 的参数顺序文档已统一，不再属于剩余问题。 |
| 审核文案、旧名称和场景编号映射 | F066、F076、F080、F081、F082、F099 | 当前指纹和正式状态是权威；文案仍可能增加认知负担。若文案能驱动批量批准或自动状态迁移，必须先修。 |
| 确定性本地派生的易用性 | F041、F046、F075 | 逐状态 facing 与证据门会拒绝错误朝向，现有完整派生命令保证审计；自动翻转、逐株 sway 和单成员 helper 属于效率增强，不能绕过现有 family/context 规则。 |
| 技术音频衍生的 provenance 表达 | F079、F089 | 最终音频仍由本地文件、时长、响度和哈希验证；后续可增加 tempo-chain 的一等 lineage。若报告开始把本地衍生误计为第二次 provider 调用，升级为 P1。 |
| 更密的声画时点证明 | F095 | 不能当作“永远忽略”。当前关键动作覆盖和 proof-time 合同能阻止状态缺失，但 narration-start 语义帧仍值得作为下一批 P2/P1 候选；任何首句动作错位复现时立即升级。 |

## 最终判断

- 高优先级项必须随 dev.22 的 schema、compiler、runtime、proof、quality、tests、文档和 packaged plugin 一起交付。
- 外部/操作边界项可以不再改仓库，但必须保留清晰失败和恢复证据。
- 其余低优先级项可以延期，不能整体删除 backlog。尤其 F095 涉及声画语义，一旦复现就不再是低优先级。
- 本批不调用任何图片、语音或视频 provider，也不消耗生产额度。
