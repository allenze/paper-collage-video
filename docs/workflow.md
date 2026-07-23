# 人机协作工作流

人负责意图、审美、事实/权利判断和外部发布授权。Codex 负责编剧、分镜、素材管理、动画和技术导演；本地脚本负责确定性状态、构建与质检。

## 默认用户路径

```text
主题
→ 概念 + 节奏故事板 + 时长/幕数 + 制作档位/预算 + provider（一次确认）
→ 风格样张 + 虚构音色（一次确认）
→ 自动批量生产、质检和预览
→ 预览批准或修改（一次确认）
→ 正式渲染并完成本地交付
```

外部上传、发送或发布不属于默认制作路径，只在用户实际请求时进行一次针对目标动作的授权。

## 状态流转

```text
capability-review
→ brief
→ concept-review
→ style-review
→ asset-production
→ preview
→ human-review
→ final-render
→ complete
```

`brief` 和 `concept-review` 由组合确认命令一次完成。

## 1. 组合概念与 provider 确认

新项目位于 `capability-review`。Codex 只用当前宿主模型准备临时 brief/概念，不调用未确认的外部或付费 provider。

它执行一次精简 provider 检查，按四种时长/幕数输入模式完成计划，并选择：

- `draft`：低成本迭代，保留必需动作，压缩增强姿态与环境呼吸；
- `balanced`：默认，关键场景独立分层，并为主要动作保留成组姿态母版；
- `full-depth`：完整环境视差、更多动作家族和最多六格的姿态母版。

`project:plan --json` 会针对当前幕数返回三个档位的准确基础生图额度、图层源包恢复 reserve、硬上限、姿态母版调用/格数、连续动效目标上限、成片影响和时长权威。单幕默认硬上限为 draft `4+2=6`、balanced `4+4=8`、full-depth `5+6=11`；reserve 是上限而不是自动消费目标。首次规划时同时传入时长、幕数等写入参数；已有已解析计划时，只传 slug 与 `--json` 即可只读重显选项而不改写项目。概念确认卡与“修改后再继续”路径都直接显示这些结构化选项；批准文件用 `planDecision` 回填档位、时长、幕数和 `human-target` / `content-derived`，避免自然语言备注与机器计划漂移。

计划完成后，Codex 先为每个节拍判断可见变化，并用 `project:storyboard` 锁定 schema-v10 `treatments`、统一 edit points、三画幅导演计划与相邻场景边界。边界的 `intent` 只表达连续、地点、时间、焦点、章节、匹配或冲击等叙事目的，独立 `treatment` 表达纸张转场、节奏/冲击硬切或高级编辑匹配；普通意图的 rhythmic cut 与 match cut 必须绑定经过冲突解析的 edit point。动作、持久显隐、组合关系、图形机制、字体、注释、数据图形和语义风险是正交维度：姿态/道具状态变化路由到 `state-sequence`，环境呼吸和镜头变化路由到连续变换，整组相机景深路由到 `depth-parallax`，会暴露隐藏像素的三层差速路由到 `registered-depth-stack`，重复装饰路由到确定性 `motif-field`。相对 rear/subject/front 运动必须先声明 clean-plate / full-silhouette / full-overlay、共享画布、严格深度、源包策略和 16:9 / 9:16 / 1:1 reveal envelope；不允许从一张只含可见像素的合成母图抠层。命令确定性编译 `compositionPlan`、`sourcePackagePlans`、`editPointPlan`、`responsivePlans`、`advancedTransitionPlans`、多维风格证明计划、姿态母版网格、实际 provider 调用、local derivatives、avoided calls 和指纹；Renderer 不含隐藏画幅特例。输入不能手写派生字段。每个节拍显式声明 proof 绑定或 null；必需动作或源包超出档位时阻断并要求提高档位或缩小故事范围，不会偷偷降级。它不增加审批次数，而是与叙事、事实、制作档位/预算、完整 `sourcePackageDecision` 和 text/image/voice provider 一起由人一次确认。`project:confirm-concept` 批量写入这些决定并记录 `capabilities-ready`、`brief-ready`、`approve-concept`，直接进入 `style-review`。

## 2. 风格与虚构音色确认

只生成编译器多维 `styleProofPlan` 所需的最少源包家族和足够判断的短试听。样张生图前先把人物身份、复杂拓扑、功能机构和说明图分类并锁定通用语义契约；宿主生图预留真实尝试额度。`style:proof` 覆盖最高语义风险类别、每种具体耦合关系和状态序列，并允许同一源包证明多种风险；它渲染 3–5 秒真实 v10 组合 proof，绑定完整目标清单和计划指纹。schema-v6 样式报告对包括 `free` 在内的所有选中目标生成非空结构化 composite。普通耦合证明包含逐成员 alpha、棋盘格、紧裁和 motion stress；`registered-depth-stack` 改用家族级 neutral reconstruction、reference comparison、exploded checkerboard，以及三个实际画幅各自正负 reveal-envelope 极值。`approve-style-voice` 会拒绝空、缺失、过期或仍待审核的证明，但不会增加第四个人工等待节点。人批准且证明通过后进入批量生产；真人声音克隆需要单独的授权与合法参考材料。

## 3. 批量生产与质量门

素材按地点、人物组、旁白组或质检批次记录 checkpoint，不为每个小文件重复写状态。每个生成/导入输出仍保留独立 request 和 provider provenance。

生成时同时遵守概念批准的图片硬上限、编译后的 `sourcePackagePlans` 与 `poseSheetPlans`；废稿、质量拒绝和生成后放弃的结果在发生额度消耗时同样计数。同一人物或道具的多个状态始终用一次 2x2 或 3x2 注册 sheet 生成并在本地保留统一画布切格/抠图。单格失败先做本地确定性重处理；若必须调用 provider，只能用完整原 sheet 作为上下文做局部 mask 编辑并证明其他格未变，否则整张重生。不得独立生一格再拼回家族。相对运动图层优先用一张 2x2 registered layer sheet 同时提供 reference、完整 rear、完整 subject 和完整 front；provider 不能可靠产出该 sheet 时，才使用一次完整 reference 加三次保留 reference 上下文的 layer edits。flat reference 只能用于重建比较，不能被 mask 冒充隐藏内容完整的成员。派生状态和 layer splits 不重复计为 provider 调用，最终报告列出真实源调用、确定性派生和避免调用。没有完整图层源包时保持 `rigid-locked` 整体运动。角色 generation family 与图层 source family 独立。图片质量逐文件绑定 SHA-256 和语义契约指纹，组合质量绑定成员、变换、reveal envelopes、环境边界、事件、场景交接、证明和语义目标。

组装后先运行 `project:composition-proof`。它只重渲染项目、资产或 runtime-build 指纹变化的证明帧/目标，并为普通耦合素材生成 alpha、棋盘格、紧裁和运动压力证据；depth stack 生成 neutral/reference/exploded 和三画幅 reveal-envelope 极值证据。显式 `--force` 会禁用所有证明缓存并写入报告。随后用 `project:quality scaffold` 生成待填写审核批次，检查真实全帧、关系裁切、跨场景人物比较、机构受力链和说明图原分辨率裁切，再用 `record-batch` 记录真实判断。脚手架不会预先通过任何检查。说明图 SVG 的程序噪声滤镜由运行时确定性拒绝。这个内部证据步骤不增加第四个人工门。

素材完成后只运行：

```bash
npm run project:assets-ready -- <slug>
```

该命令依次同步真实旁白时长与 timing、生成/导入字幕时间、执行音频-only LUFS/真峰预检、核对故事板蓝图/v10 组合与源包/v9 editorial/状态序列/关键帧/edit points/高级切换/三画幅导演计划、核验组合证明指纹、执行资产与组合双质量门并推进到 `preview`。在 `preview` / `human-review` 阶段重复执行会做幂等复核而不再次 advance。随后 `project:preview` 渲染半尺寸预览、技术报告、证明时刻联系表和转场联系表；报告列出转场意图/类型、匹配连续性、硬切比例和边界采样。视觉和音频指纹都不变时复用 artifact，只改音频时复用视频流并重新混音/封装，任何视觉指纹变化都强制完整渲染。

渲染并发默认按可用 CPU 自动决定并封顶为 8。若完整 Chrome 在多页并发时无响应，可用 `PAPER_COLLAGE_RENDER_CONCURRENCY=1 npm run project:preview -- <slug>`（最终渲染同理）走正式的单路重试路径；该设置只控制同时打开的渲染页数，不改变帧率、画质或成片内容。

## 4. 预览、修改与正式交付

人查看预览并批准或用自然语言提出修改。修改会回到 `asset-production`。纯导演调整使用 `project:revise-preview-directing -- <slug> --input=<storyboard.json>`：只允许改节奏、treatments、证明时刻和合法场景边界，重新校验既定 motion budget，保护已批准概念/风格，并自动使旧预览、报告和受影响工作项失效。概念或制作档位变化仍走各自审批路径。

预览批准后运行 `project:render`。正式 MP4、报告、联系表和校验报告通过后，状态直接进入 `complete`。这只表示本地制作完成，不授权任何外部发布。

## 恢复与控制

每个新回合或中断后只运行一次：

```bash
npm run project:resume -- <slug>
```

- `auto-continue`：继续 `nextCommand` 或第一个未完成批次；
- `wait-human`：展示当前门禁产物、原因和明确回复方式；
- `complete`：报告本地交付产物。

不再同时运行 full status 和 `project:handoff-check`。只有诊断异常状态时才读取完整历史。

## 状态与来源边界

- `brief.md`：人的意图、事实、风格、格式和权利边界；
- `production.json`：阶段、审批、粗粒度批次、产物、事件历史；
- `storyboard.json`：已批准的 v10 节拍 treatments、source package、edit points 与三画幅/高级切换导演计划，以及编译生成的动作/调用预算、风险排名和证明指纹；
- `project.json`：Creative Plan v3 预算、源包决定和 Remotion v10 递归组合执行树；
- `requests/*.json` / `assets-manifest.json`：schema-v7 逐素材输入、layer package/组合绑定与注册源家族；
- `quality-report.json`：逐文件和组合关系的技术/语义质量与指纹；
- `review.md`：自动审批摘要与自然语言修改历史。

这些文件各自只维护一种事实，避免在多个上下文中重复完整状态、请求或 provenance。

## 必须额外停下的情况

- 会改变核心立场、目标受众或已批准的制作档位/成本；
- 明确时长与幕数无法同时满足；
- provider 失效且切换服务会改变费用或授权；
- 需要真人克隆、品牌/肖像或授权不明素材；
- 准备上传、发送或发布到具体外部目标。
