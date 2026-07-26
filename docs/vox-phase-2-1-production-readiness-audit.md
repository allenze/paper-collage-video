# VOX Phase 2.1 生产就绪审计

审计日期：2026-07-23

审计分支：`codex/vox-phase-2-1-production-readiness-audit`

审计范围：Paper Collage Video v9 / VOX Phase 2 编辑系统

付费调用：0

## 结论

结论为 **Conditional Go**：v9 编辑系统可以进入一个受控、非最终参考样片的正式生产
pilot。源码、打包插件和 fresh installed-cache 必须保持同一 runtime fingerprint；provider、
预算、概念、风格/音色和预览仍须经过既有人审门。

本次 fresh installed-cache canary 发现并修复了一个 P1：

- `schema:v9` 曾隐式依赖已经存在的
  `dist/vox-phase2-proof/inputs/storyboard-authoring.json`，全新工作区第一次直接运行会失败。
- `0.16.0-dev.2` 改为由正式 Node 入口先用本地 fixture 物化 v9 authoring、compiled
  storyboard 和三个 Project 输入，再调用 Python validator。该入口不调用 provider，也不
  启动 Chromium，并纳入 runtime-build fingerprint。

审计后没有未处理的仓库可控 P0/P1。仍有两个 P2 工程增强项和三个 connector/host 外部
限制；它们不阻断受控 pilot，但应在涉及对应能力时显式纳入制作计划。

后续状态说明：Phase 2.2 已完成 F035 与 F037 的正式纵向切片；下表中这两项的 Phase
2.1 历史状态已标注为被
[`vox-phase-2-2-asset-family-hardening.md`](vox-phase-2-2-asset-family-hardening.md)
supersede，production pilot 应按 Phase 2.2 当前契约执行。

## 审计口径

“关闭”只表示现行一等契约、实现、验证和打包路径已提供对应保障，不表示任何新项目的
审美与语义质量会自动通过。“受控”表示风险有正式合同或证明门，但仍需要 host、人工或
真实生产输入。“外部”表示仓库不能伪造 connector/host 能力。“P2”表示正式生产可以有
边界地继续，但通用性或自动诊断仍值得增强。

本轮实际检查：

1. 从真实安装缓存 bootstrap 全新工作区，并由 bootstrap 安装 npm 与独立 `.venv`。
2. `doctor --ready`、provider status、一次 `project:resume`。
3. 完整 `npm test`，NumPy、Pillow、PyYAML 均存在且无跳过。
4. TypeScript typecheck、独立 `schema:v9`。
5. starter 的真实 Style Proof、强制无缓存 Composition Proof、质量门和
   `project:preview`。
6. Phase 2 proof gallery 的 16:9、9:16、1:1 Chromium 渲染与正式 verifier。
7. npm audit、Skill quick validation、source/package drift、最终安装缓存和第二个
   fresh workspace 复验。

## F001–F060 当前处置矩阵

| ID | 当前处置 | 责任边界 | 当前证据或剩余动作 |
|---|---|---|---|
| F001 | 关闭 | 仓库 | state-sequence 编译与校验要求有序状态和从起点可解析的首状态；状态族测试覆盖。 |
| F002 | 关闭 | 仓库 | 语义 target 可先绑定 compiled storyboard，runtime composition 随后严格复核。 |
| F003 | 关闭 | 仓库 | `styleProofPlan` 按语义、耦合、状态风险覆盖，不再只取单一静态最高分。 |
| F004 | 关闭 | 仓库 | diagram 的 raster asset 与 composite 可读性检查按 scope 分离。 |
| F005 | 受控 | Host | request v6 固定输出路径、画布、surface 和 fingerprint；host 是否按路径落盘仍由 connector 决定。 |
| F006 | 受控 | Host | provider 配置、alias 和 canonical invocation 已正式化；具体 host tool/model 仍需 capability check。 |
| F007 | 外部 | Connector | ChatCut TTS 是否直接返回本地文件不由本仓库控制。 |
| F008 | 受控 | 运行环境 | bootstrap/Remotion 正式安装 headless shell，也支持明确 browser executable；离线首次安装仍需预置依赖。 |
| F009 | 关闭 | 仓库 | 渲染并发按 CPU 限制且支持 `PAPER_COLLAGE_RENDER_CONCURRENCY=1`；fresh canary 成功。 |
| F010 | 受控 | Host UI | proof/report 使用 SHA-256、独立路径和 `--force`；宿主单图查看器缓存行为仍在仓库外。 |
| F011 | 关闭 | 仓库 | free target 也生成结构化 composite、full/crop/debug 证据。 |
| F012 | 关闭 | 文档/仓库 | setup 明确区分 headless shell、完整 Chrome 和执行环境权限。 |
| F013 | 关闭 | 仓库 | style-scope proof 可直接满足匹配的 style quality target。 |
| F014 | 关闭 | 仓库 | Style Gate 只校验选定 style scope，不再错误要求完整项目 composition。 |
| F015 | 受控 | 人审 | 风格一致性属于 Style Gate 的人工审美判断，系统不宣称自动判定。 |
| F016 | 关闭 | 仓库 | editable graphic、独立 asset、treatment 和 persistent event 取代烘焙/临时 opacity 堆叠。 |
| F017 | 关闭 | 仓库 | output surface 校验拒绝棋盘格假透明和无效 alpha/chroma 边界。 |
| F018 | 受控 | Host | attempt ledger、reserve、canonical invocation 和预算锁已存在；host 仍必须在调用前执行 reserve。 |
| F019 | 关闭 | 仓库 | `provider:recover-record` 可从已计费 succeeded attempt 恢复唯一 provenance，且不重复计费。 |
| F020 | 关闭 | 仓库 | state sequence 的 hold state、尾帧 proof 和禁止 final crossfade 有确定性测试。 |
| F021 | 受控 | Host UI | checkerboard isolate、despill、透明 RGB padding 证明真实合成；单图查看器底色显示不作为 alpha 权威。 |
| F022 | 受控 | Host | 完整 request fingerprint 与 canonical invocation 固定真实 prompt；host 是否完整消费仍为外部执行责任。 |
| F023 | 关闭 | 仓库 | lifecycle 非 active 记录进入 history，不进入 current pass denominator。 |
| F024 | 关闭 | 仓库 | style gate 要求完整 plan fingerprint 和非空 target/composite 证据。 |
| F025 | 受控 | Authoring | composition、semantic、surface 保持显式；validator 给出字段定位，不隐式猜测创作语义。 |
| F026 | 关闭 | 仓库 | connector tool/model 可通过 provider alias 记录为正式 provenance。 |
| F027 | 关闭 | 仓库 | `provider:attempt summary` 为只读摘要，不写入配额账本。 |
| F028 | 外部 | Connector | 已生成 TTS 的本地下载能力仍取决于 ChatCut/host。 |
| F029 | 外部 | Browser host | 网页已下载但 download event 超时属于 Browser host 行为。 |
| F030 | 关闭 | 仓库 | submit provider 与 provenance provider 通过 alias/canonical id 统一。 |
| F031 | 关闭 | 仓库 | inferred tail 受限；明确 authored timeline 和 proof-backed quiet hold 保留作者意图。 |
| F032 | 关闭 | 仓库 | visibility proof window 包含动作后的 persistent settled state，直到下一次可见性变化。 |
| F033 | 关闭 | 仓库 | `project:revise-preview-directing` 正式重编合法的 proof timing/directing 修订。 |
| F034 | 受控 P2 | Production | 编译、Schema 和 project validator 已前置；仍需在首个真实 provider pilot 记录“首次校验错误数/修复轮次”。 |
| F035 | 已被 Phase 2.2 supersede（历史：P2 待增强） | 仓库 | Phase 2.2 已提供 `registered-family` schema/binding、`assets:derive-registered-family`、manifest provenance/lifecycle、proof、quality、tests 与 packaged-plugin 验证；pilot 继续用真实 provider source 验证 production 行为。 |
| F036 | 关闭 | 仓库 | chroma-key despill、matte、缩放合成回归和 proof evidence 已覆盖洋红污染。 |
| F037 | 已被 Phase 2.2 supersede（历史：受控 P2） | 仓库/人审 | Phase 2.2 已加入原始分辨率与实际 proof/render 缩放下的低 alpha 矩形裁切带检测、JSON/overlay evidence、validation/quality gate 与 fixtures；checkerboard、tight crop、motion-stress 人审仍为必要语义证据。 |
| F038 | 关闭 | 仓库 | runtime 不再对注册 support 画布统一施加会显出边界的投影。 |
| F039 | 关闭 | 仓库 | proof fingerprint 绑定 runtime；本轮 `--force` 实测 0 帧/0 composite 复用。 |
| F040 | 关闭 | 仓库 | transparent RGB 使用 edge-pad/neutral 策略，缩放回归未出现色键渗色。 |
| F041 | 关闭 | 仓库 | key-edge 检查区分 metadata key 与 neutral transparent RGB。 |
| F042 | 关闭 | 仓库 | current/history 分母与 F023 统一。 |
| F043 | 关闭 | 仓库 | record-batch 默认继承当前 fingerprint-bound evidenceFiles。 |
| F044 | 关闭 | 仓库/人审 | audio calibration proposal/accept 指纹化；fresh preview 实测响度通过。 |
| F045 | 关闭 | 仓库 | support shadow 修复位于默认 editable runtime，而非渲染期临时 patch。 |
| F046 | 关闭 | 仓库 | `activeUntil` 与 `holdStateId` 表达循环后定格。 |
| F047 | 关闭 | 仓库 | supported-subject 正式支持 `subject-front` layering。 |
| F048 | 关闭 | 仓库 | `paper-tab` 为正式 typography treatment。 |
| F049 | 关闭 | 仓库 | preview return gate 后的 directing revision 有正式命令、状态转换、比较报告和测试。 |
| F050 | 关闭 | 仓库 | 默认 runtime 的 support 投影根因修复并由 proof fingerprint 约束。 |
| F051 | 关闭 | 仓库 | 正式并发 override 已打包，且有边界校验。 |
| F052 | 关闭 | 打包 | `remotion.config.ts` 包含于模板；fresh installed-cache Chromium 渲染成功。 |
| F053 | 关闭 | 打包 | version 与 `runtime-build.json` fingerprint 双重标识 executable identity。 |
| F054 | 关闭 | Bootstrap | npm/pip 使用可写安装路径和独立 `.venv`；fresh bootstrap 成功。 |
| F055 | 关闭 | Fixture | starter 事件均在场景范围内；Style Proof、Composition Proof、Preview 实测通过。 |
| F056 | 关闭 | 仓库 | style proof 按 `proofTimeId`/target/treatment 精确作用域生成。 |
| F057 | 关闭 | Bootstrap | `requirements.txt` 明确包含 PyYAML；fresh 全测试无依赖跳过。 |
| F058 | 关闭 | 打包测试 | directing revision 使用自包含 fixture；fresh package 全测试不依赖生产项目。 |
| F059 | 外部且已缓解 | Codex host | Responses Lite 审批错误不由仓库控制；本轮分支、bootstrap 和 Chromium 提权均已正常执行。 |
| F060 | 关闭 | 仓库 | 全 decorative/free 项目自动得到 `baseline:representative`，fresh starter Style Proof 成功。 |

## Fresh installed-cache canary

审计工作区最初由实际安装的 `0.16.0-dev.1` 创建：

`/private/tmp/vox-phase2-1-audit.HnxeEI`

它证明了原始 P1 的可复现性，也证明不是用户 `config.toml`、Responses Lite 或 Chromium
权限问题：

- bootstrap、doctor、provider status：通过；
- `npm test`：133/133，通过，0 skipped；
- `npm run check`：通过；
- 首次直接 `npm run schema:v9`：失败，缺少 Phase 2 proof inputs；
- `proof:phase2:prepare` 后再次 `schema:v9`：通过；
- starter Style Proof：通过；
- starter `composition-proof --force`：3/3 帧重新渲染，0 cache reuse；
- quality：5/5；
- starter preview：36 帧，960×540，30 fps，音频存在，实测 -24.07 LUFS /
  -22.95 dBTP，连续性通过；
- Phase 2 三画幅 preview 与 verifier：通过；
- 三画幅 typography、annotation、data SVG、responsive directing、transition 和
  fingerprint reports：通过。

最终 `0.16.0-dev.2` 复验：

- source `npm test`：142/142，通过，0 skipped；
- source `npm run check`、`npm run schema:v9`、`npm audit`：通过，0
  vulnerabilities；
- source 与 packaged Skill quick validation：通过；
- source Phase 2 三画幅 Chromium render 与 verifier：通过；
- source 与 packaged runtime fingerprint 一致：
  `9fdb9cdd60a484ef03b4d6438196829384e5831fddff1e0cb265e53a94b19d42`；
- 正式安装缓存：
  `/Users/lester/.codex/plugins/cache/paper-collage-video/paper-collage-video/0.16.0-dev.2`；
- packaged plugin 与安装缓存 `diff -qr`：无漂移；
- 最终 fresh workspace：
  `/private/tmp/vox-phase2-1-dev2-fresh.qq2bu1`；
- final fresh workspace 在不存在 `dist/vox-phase2-proof` 时第一次直接运行
  `schema:v9`：通过；
- final fresh workspace `npm test`：133/133，通过，0 skipped；
- final fresh workspace typecheck、npm audit、三画幅 Chromium render 与 verifier：
  通过；
- source proof artifact：
  `/Users/lester/Documents/free-lester/Remotion/dist/vox-phase2-proof`；
- final fresh-cache proof artifact：
  `/private/tmp/vox-phase2-1-dev2-fresh.qq2bu1/dist/vox-phase2-proof`。

## 进入 production pilot 的约束

1. pilot 不是最终参考样片，不发布、不 push、不 tag。
2. 在任何 provider 调用前，仍需明确概念、production profile、provider/model、预算和
   generation attempt 上限。
3. F035 的 Phase 2.1 前置条件已被 Phase 2.2 supersede。pilot 使用
   `supported-subject` 三层共享画布时，必须通过正式 `registered-family` spec 与
   `assets:derive-registered-family` 路径执行，并保留完整 source lineage。
4. F037 的 Phase 2.1 自动检测缺口已被 Phase 2.2 supersede。任何 alpha/foreground
   family 都必须同时通过原始分辨率与实际 proof/render 缩放的 alpha-band 检测，并人工
   检查 checkerboard、tight crop 和 motion-stress；`key-edge-clean` 仍不得替代二者。
5. 记录首次 full project validation 的错误数量、错误出现阶段和修复轮次，用真实数据决定
   F034 是否可以完全关闭。
6. 本地音频及其实际 timing data 是 edit-point 证明权威；不得以 TTS token latency 或估算
   时长替代。

## 建议的下一步

下一步应是一个 1–2 幕、单一视觉风险、严格预算的 production pilot。优先验证真实本地
旁白 timing、一个可编辑 typography treatment、一个 annotation、一个 data SVG 状态和
一个高级 transition；先不引入 supported-subject，以便把 provider/authoring/quality
路径的实际摩擦与 F035 分离。pilot 通过后再决定是否开始最终参考样片。
