# 人机协作工作流

人负责意图、审美、事实/权利判断和外部发布授权。Codex 负责编剧、分镜、素材管理、动画和技术导演；本地脚本负责确定性状态、构建与质检。

## 默认用户路径

```text
主题
→ 画幅 + 三选一视觉风格 + 视差偏好（一次轻量选择）
→ 共同故事骨架 + 三档故事/制作/成本方案
→ 方案 + 概念 + 节奏故事板 + 精确预算 + provider（一次确认）
→ 故事专属风格样张 + 虚构音色 + 3–5 秒运动证明（一次确认）
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

intake 与三档方案都发生在 `capability-review` 内；`brief` 和
`concept-review` 由组合确认命令一次完成。

## 1. Intake：先确定观看方向

新项目位于 `capability-review`。Codex 只用当前宿主模型准备临时 brief/概念，不调用未确认的外部或付费 provider。

`project:intake --json` 返回三个结构化问题：

- `16:9`（1920×1080）或 `9:16`（1080×1920）；
- 儿童绘本纸片、手绘剪纸 / 手绘解释、复古档案拼贴；
- 分层视差：自动推荐、优先使用、尽量少用。

系统先并排展示三张使用同一龟兔森林构图的内置文生图 PNG，再打开 Ask
Question。图片无文字、随插件版本化并进入 runtime fingerprint；生成成本只在
插件开发时发生一次，用户每次选择时只是读取本地文件，不调用 provider。它们只
帮助理解视觉语言，不能替代后续故事专属风格样张。
“分层视差”是文字描述的运动偏好，不是第四种视觉风格。第一弹窗不选择成本。

## 2. 三档方案与组合确认

intake 确认后，Codex 只用宿主模型生成一个共同故事骨架和三个
`planning-scenarios`。用户明确提供的时长/幕数在三档中保持不变；否则：

- 轻量成片（`draft + concise`）：人物/背景/可选前景，以移动、渐显、推拉、呼吸、上下浮动、摆动、抖动、倾斜和转场等本地运动为主，只生成语义必需状态；
- 均衡动画（`balanced + standard`）：关键人物/道具使用 2–4 格状态序列，关键幕选择性分层、景深和视差；
- 完整纵深（`full-depth + expanded`）：更多动作家族和合理的 4–6 格状态、rear/mid/front/near、多层视差、循环世界、天气与服务叙事的环境生命。

系统先完成一次只读 provider status。每张卡展示时长、幕数、节拍、动作状态、素材层、视差、环境元素、
本地运动目标、预计图片调用、建议人批上限、profile hard ceiling、本地派生、
避免调用、实际可用 provider/成本依据、事实/权利风险和最终效果。预计调用包含故事专属风格样张。
系统默认推荐均衡动画，但不能替用户选择。

选择后运行 `project:plan --scenario=<id>`。计划写入 scenario/option 指纹和
`profilePromise`。motion/image budget 是上限；`profilePromise` 是动作家族、
总状态、本地运动、分层幕、视差幕和环境幕的下限。选择完整纵深却只实现轻量
成片会在 `project:storyboard` 编译时失败。

本地变换可以表达情绪、强调、位移、进退场、镜头和环境循环；不能假装轮廓、
肢体、手持物、接触关系、机构状态、真实跑步或睡醒发生了变化。这些必须使用
状态家族或耦合组合契约。

用户选择一张卡即完成这一次组合批准，不再追加例行确认。系统随后自动物化计划、为整片编排结构化 `motionDirection`、为每个节拍分配 `performanceRole` 并判断可见变化，再用 `project:storyboard` 锁定 schema-v11 `treatments`、统一 edit points、三画幅导演计划与相邻场景边界。命令确定性编译 `motionContract`、`compositionPlan`、`sourcePackagePlans`、多维风格证明计划、姿态母版网格、provider/local/avoided 调用账目和指纹。`project:confirm-concept` 会核对 storyboard 的姿态家族、状态清单和注册源包是否与已批准卡片完全一致；只有一致时才复用刚才的选择记录 `scenarioDecision`、`budgetDecision`、`sourcePackageDecision` 和 provider。若发生实质漂移，回到同一方案门展示更新后的精确卡，而不是悄悄继续。在 cap 记录前不得调用图片 provider。

## 3. 风格与虚构音色确认

只生成编译器多维 `styleProofPlan` 所需的最少源包家族和足够判断的短试听。样张生图前先把人物身份、复杂拓扑、功能机构和说明图分类并锁定通用语义契约；宿主生图预留真实尝试额度。需要透明运动层的 registered 2×2 sheet 使用逐格 surface：reference/rear 保持不透明，subject/front 在宿主模型原生 alpha 不可靠时使用已声明且不与主体冲突的纯色色键。provider-native 原图原样登记，分隔线裁除、色键、缩放和 key metadata 由正式 registered-family 派生器完成并计为三个本地 derivative。`project:style-proof` 覆盖最高语义风险类别、每种具体耦合关系和状态序列，并允许同一源包证明多种风险；它渲染 3–5 秒真实 v11 组合 proof，绑定完整目标清单、计划指纹和动作契约双指纹。schema-v7 样式报告对包括 `free` 在内的所有选中目标生成非空结构化 composite。现有 style/voice gate 同时展示 `motion-language-card.json`，并把人的决定归因写入 `motion-approval.json`，不增加第四个人工等待节点。普通耦合证明包含逐成员 alpha、棋盘格、紧裁和 motion stress；`registered-depth-stack` 改用家族级 neutral reconstruction、reference comparison、exploded checkerboard，以及三个实际画幅各自正负 reveal-envelope 极值。`approve-style-voice` 会拒绝空、缺失、过期或仍待审核的证明。人批准且证明通过后进入批量生产；真人声音克隆需要单独的授权与合法参考材料。

## 4. 批量生产与质量门

素材按地点、人物组、旁白组或质检批次记录 checkpoint，不为每个小文件重复写状态。每个生成/导入输出仍保留独立 request 和 provider provenance。

生成时同时遵守概念批准的精确图片 attempt 上限、profile ceiling、编译后的 `sourcePackagePlans` 与 `poseSheetPlans`；profile ceiling 较大也不能越过更窄的人批 cap。废稿、质量拒绝和生成后放弃的结果在发生额度消耗时同样计数。同一人物或道具的多个状态始终用一次 2x2 或 3x2 注册 sheet 生成并在本地保留统一画布切格/抠图。一个 `poseFamilyId` 即一张 provider 状态母版：同一连续镜头为了显隐、睡醒或追赶而使用多个时间实例时，`poseSheetPlans.targetIds` 会列出全部复用节点，但只计一次 provider 调用。单格失败先做本地确定性重处理；若必须调用 provider，只能用完整原 sheet 作为上下文做局部 mask 编辑并证明其他格未变，否则整张重生。不得独立生一格再拼回家族。相对运动图层优先用一张 2x2 registered layer sheet 同时提供 reference、完整 rear、完整 subject 和完整 front；provider 不能可靠产出该 sheet 时，才使用一次完整 reference 加三次保留 reference 上下文的 layer edits。flat reference 只能用于重建比较，不能被 mask 冒充隐藏内容完整的成员。派生状态和 layer splits 不重复计为 provider 调用，最终报告列出真实源调用、确定性派生和避免调用。没有完整图层源包时保持 `rigid-locked` 整体运动。角色 generation family 与图层 source family 独立。图片质量逐文件绑定 SHA-256 和语义契约指纹，组合质量绑定成员、变换、reveal envelopes、环境边界、事件、场景交接、证明和语义目标。只读 attempt summary 与 validation report 同时给出 profile ceiling、人批 cap、预计、已用、预留和剩余额度，作为预算 proof。

组装后先运行 `project:composition-proof`。它使用移除字幕的专用输入，只重渲染项目、资产或 `composition-proof` runtime surface 指纹变化的证明帧/目标，因此字幕实现独立变化不会清空资产和组合审核；普通耦合素材生成 alpha、棋盘格、紧裁和运动压力证据，depth stack 生成 neutral/reference/exploded 和三画幅 reveal-envelope 极值证据。仅用于注册技术来源的顶层耦合组声明 `renderParticipation=derivation-only`，不进入画面、导演档位或人工构图审核，只接受确定性的完整性、provenance 和派生检查。报告也写入已验证的世界与轨迹契约摘要。显式 `--force` 会禁用所有证明缓存并写入报告。随后用 `project:quality scaffold` 生成待填写审核批次，检查真实全帧、关系裁切、跨场景人物比较、机构受力链和说明图原分辨率裁切，再用 `record-batch` 记录真实判断。脚手架不会预先通过任何检查。说明图 SVG 的程序噪声滤镜由运行时确定性拒绝。这个内部证据步骤不增加第四个人工门。

素材完成后只运行：

```bash
npm run project:assets-ready -- <slug>
```

该命令依次核对当前动作语言批准、同步真实旁白时长与 timing、生成/导入字幕时间、构建确定性时间线混音并实际编码/检测 96k 预览 AAC 与 192k 最终 AAC、核对故事板蓝图/v11 组合与动作契约/源包/v9 editorial/状态序列/关键帧/edit points/高级切换/三画幅导演计划、核验组合证明指纹、执行资产、组合和整片动作质量门并推进到 `preview`。节点关键帧位移统一使用相对父级的 `offsetX`/`offsetY`；`transform.x`/`transform.y` 是绝对布局，相机 `x`/`y` 是像素。质量 scaffold 的每条证明都绑定当前组合指纹与证据 SHA-256，旧帧不能混入新审查。在 `preview` / `human-review` 阶段重复执行会做幂等复核而不再次 advance。随后 `project:preview` 首先检查 seal/未完成工作项，再执行其他预检与半尺寸渲染；新渲染和音频-only 刷新都会直接复用已检测的对应 AAC 码流。视觉和音频指纹都不变时复用 artifact，只改音频时复用视频流，任何视觉指纹变化都强制完整帧渲染。

渲染并发默认按可用 CPU 自动决定并封顶为 8。若完整 Chrome 在多页并发时无响应，可用 `PAPER_COLLAGE_RENDER_CONCURRENCY=1 npm run project:preview -- <slug>`（最终渲染同理）走正式的单路重试路径；该设置只控制同时打开的渲染页数，不改变帧率、画质或成片内容。

## 5. 预览、修改与正式交付

人查看预览并批准或用自然语言提出修改。修改会回到 `asset-production`。纯导演调整使用 `project:revise-preview-directing -- <slug> --input=<storyboard.json>`：只允许改节奏、treatments、证明时刻和合法场景边界，重新校验既定 motion budget，保护已批准概念/风格，并自动使旧预览、报告和受影响工作项失效。概念或制作档位变化仍走各自审批路径。

预览阶段需要检查一幕实际构图时，运行 `project:scene-preview -- <slug> --scene=<sceneId>`；它从当前 `project.json` 的真实节点、旁白和运行时独立渲染该幕，而不是用风格样张替代。需要合并相邻幕时，先运行 `project:stitch-narration -- <slug> --scenes=<a,b,...> --target-scene=<new-id>`，它只拼接已批准的本地旁白，记录原幕、SHA-256、连续字幕偏移和明确下一步；随后将经过审阅的合幕 scene 写入导演重编并重新证明。`project:budget` 以一份只读摘要显示 profile ceiling、人批 cap、故事板预计调用、已用、预留、剩余和避免调用。渲染期间可调用 `project:render-status` 查询持久化阶段、artifact 和错误；它只在运行时有正式进度来源时显示百分比，静默 Remotion CLI 会明确报告百分比不可得而不是输出逐帧噪声。

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
- `project.json.intake` / `project.json.styleProfile`：画幅、内置视觉风格与视差偏好，以及冻结后的生成指令、动效偏好、渲染主题、质量门禁、参考图和风格指纹；
- `planning-scenarios.json`：共同故事骨架、三档详细方案、预计调用、建议 cap、hard ceiling 和质量承诺；
- `production.json`：阶段、审批、粗粒度批次、产物、事件历史；
- `storyboard.json`：已批准的 v11 全片动作方向、节拍角色/treatments、source package、edit points 与三画幅/高级切换导演计划，以及编译生成的动作契约、调用预算、风险排名和证明指纹；
- `project.json.plan`：Creative Plan v4 scenario 指纹、story scope、profile ceiling、质量下限和人批图片 attempt 上限；
- `requests/*.json` / `assets-manifest.json`：schema-v8 逐素材输入、可执行风格绑定、layer package/组合绑定与注册源家族；
- `quality-report.json`：逐文件和组合关系的技术/语义质量与指纹；
- `review.md`：自动审批摘要与自然语言修改历史。

这些文件各自只维护一种事实，避免在多个上下文中重复完整状态、请求或 provenance。

## 必须额外停下的情况

- 会改变核心立场、目标受众或已批准的制作档位/成本；
- 明确时长与幕数无法同时满足；
- provider 失效且切换服务会改变费用或授权；
- 需要真人克隆、品牌/肖像或授权不明素材；
- 准备上传、发送或发布到具体外部目标。
