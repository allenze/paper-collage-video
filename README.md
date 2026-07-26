# Paper Collage Video Pipeline

[![CI](https://github.com/cyberlesterr/paper-collage-video/actions/workflows/ci.yml/badge.svg)](https://github.com/cyberlesterr/paper-collage-video/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

一个配置驱动的本地纸片分层视频生产系统。人负责内容意图、审美选择和最终批准；Codex 与本地工具负责节奏故事板、素材组织、分层关键帧、持久显隐与视听事件、旁白同步、渲染和技术验收。

当前开发协议为 project/storyboard v10（editorial subsystem 仍为 v9）；旧项目不会自动迁移或回退。v10 保留递归组合、注册源家族、camera-coupled parallax、节奏硬切、确定性 `motif-field`、统一 edit point、编辑型字体、解释型注释、数据驱动 SVG、三画幅导演计划与高级编辑切换，并新增生图前的 layer-complete source package、`registered-depth-stack`、responsive reveal envelope 和精确 provider/local/avoided 调用账目。所有这些行为都由 authoring、compiled plan、运行时、质量报告和正式证明共同约束。插件发行包带一个 2 秒低电平测试音技术夹具 `starter-demo`。

当前公开稳定版本为 [`0.8.0`](https://github.com/cyberlesterr/paper-collage-video/releases/tag/v0.8.0)，仓库中正在验证的开发版为 `0.16.0-dev.8`。新协议加入节奏故事板、注册组合模式、完整图层源包、provider-native observed key plane、逐格 opaque/chroma-key registered sheet、rejected-output recovery-source、人工批准的精确图片 attempt 上限、本地关键帧、持久显隐/短暂强调/声音共源事件、7 种动画纸张转场与意图路由、人物/拓扑/机构/说明图语义契约、真实生成尝试账本、VOX Phase 2 编辑系统、registered-family 本地派生、无缝 looping world strips、camera-compensated world-motion proof、双尺度低 alpha 矩形残留检测与资产/组合双质量门；功能和协议仍可能在 `1.0.0` 前调整。

## 完整演示

[观看或下载唯一完整演示：《铁杵磨针》77.7 秒 1080p 纸片故事](https://github.com/cyberlesterr/paper-collage-video/releases/download/v0.5.0/tie-chu-mo-zhen-final.mp4)

Release 页的旧演示用于展示上一代质量门、六幕时间线、景深运动、字幕、虚构旁白和技术验收能力，不代表当前 v9 数据合同；使用边界见 [ASSET_LICENSES.md](ASSET_LICENSES.md)。

当前 v10 还保留一个 6 秒、零生图调用的 VOX 工程样片。它同时覆盖三层 camera-coupled parallax、带排除区与循环证明的固定种子 `motif-field`、可编辑大字标题，以及绑定边界节拍的 rhythmic cut：

```bash
npm run sample:vox
npm run sample:vox:verify
```

输入与正式证明合同位于 `fixtures/vox-primitives/`，输出为 `dist/vox-primitives/preview.mp4`，证明报告与固定帧联系表位于 `dist/vox-primitives/proof/`。验证命令会绑定 v10 项目/故事板、runtime build、全部夹具素材、编码规格、六个 proof time 与第 90 帧 rhythmic cut。该夹具用于验证可复现的制作原语，不替代带旁白、音乐和人工质量审查的正式成片。

Phase 2 另带完全本地、无需 provider 的三画幅 proof gallery：

```bash
npm run proof:phase2:prepare
npm run proof:phase2:render
npm run proof:phase2:verify
```

它使用合成 WAV、确定性 SVG 与同一份语义 Storyboard，实际渲染 16:9、9:16、1:1 三个导演计划，并产出 edit-point、响应式导演、文字 fit/overflow、注释避让、图表/地图/时间线、切换 before/at/after、联系表、质量与全量 SHA-256/fingerprint 报告。输出位于 `dist/vox-phase2-proof/`，不属于最终参考样片。

## 从 GitHub 安装 Plugin

面向普通用户的推荐路径是安装 Codex Plugin，不需要手动 clone 本仓库。仓库包含机器可读的 marketplace、插件清单、Skill、工作区初始化器和轻量 Remotion 模板。

用户可以直接把 GitHub 地址交给 Codex：

```text
请安装这个 Codex 插件并完成初始化验证：
https://github.com/cyberlesterr/paper-collage-video
```

Codex 对应执行：

```bash
codex plugin marketplace add cyberlesterr/paper-collage-video
codex plugin add paper-collage-video@paper-collage-video
```

安装后新建一个 Codex 任务，再说：

```text
用 $make-paper-collage-video 做一条约 30 秒的玄奘西行纸片分层视频。
```

首次调用会从插件自带模板创建独立、可写的 Remotion 工作区，安装依赖并运行环境诊断。项目、依赖和渲染结果不会写入 Codex 的插件缓存。用户可能仍需批准依赖下载、FFmpeg 安装或图片/语音提供方授权。

源码采用 [MIT License](LICENSE)。测试夹具、纸张纹理和其衍生媒体不采用 MIT，只能按 [ASSET_LICENSES.md](ASSET_LICENSES.md) 随仓库运行、测试和演示。

### 本地开发安装演练

仓库维护者可以从本地 marketplace 安装同一个插件：

```bash
npm run plugin:sync
codex plugin marketplace add /absolute/path/to/paper-collage-video
codex plugin add paper-collage-video@paper-collage-video
```

修改插件后重新运行 `npm run plugin:sync` 和插件校验，再按本地插件更新流程刷新缓存。插件源位于 `plugins/paper-collage-video/`；`skills/make-paper-collage-video/` 是制作流程的维护源，`plugin:sync` 会把它和轻量运行时同步到发行包。

## 最简单的用法

在 Codex 中直接说：

```text
用 $make-paper-collage-video 做一条约 30 秒的玄奘西行纸片分层视频。
```

Skill 的维护源位于 `skills/make-paper-collage-video/`，发行副本位于插件包中。标题型请求先用三张内置对比图选择画幅、视觉风格和视差偏好，再比较轻量成片、均衡动画、完整纵深三个故事/制作/成本方案；选定方案、精确预算和 provider 后才允许任何图片调用。之后只在故事专属风格/虚构音色/运动证明和预览节点停下来。正式成片在本地技术验收通过后即完成交付，只有真正上传、发送或发布时才请求一次外部操作授权。中断后用精简的 `project:resume` 从未完成批次继续。

## 人在流程中的位置

正常制作一条新视频时，人参与四个内容节点：

1. 选择 16:9 / 9:16、三种内置视觉风格之一和分层视差偏好。
2. 比较三档故事与制作方案，一次确认所选 scenario、Storyboard v10、精确图片上限和文本/生图/虚构语音 provider。
3. 确认故事专属风格样张、短试听和 3–5 秒动作证明。
4. 查看 `preview.mp4`，批准或用自然语言提出修改意见。

最终视频和验收报告由系统自动交付；本地完成不等于允许外部发布。

人不需要手写人物坐标、处理透明通道、计算旁白帧数、修改 React 或执行 FFmpeg。`project.json` 是 Codex 和工具维护的机器协议。

完整的人机边界和审批节点见 [docs/workflow.md](docs/workflow.md)。

## 环境

- Node.js 20+
- FFmpeg / ffprobe
- Python 3.11+（只在处理色键素材表时需要）

当前 CI 在 Ubuntu、Node.js 20 和 Python 3.12 上运行；维护者同时在 macOS 上验证。代码包含 Windows 命令与虚拟环境路径适配，但尚未加入 Windows CI，因此当前属于尽力支持。

```bash
npm ci
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
npm run doctor -- --ready
npm run provider:status
```

Windows 使用 `.venv\\Scripts\\python.exe -m pip install -r requirements.txt`。

## 开发验证

```bash
npm test
npm run check
npm run bundle
npm run doctor -- --ready
```

`npm run dev` 打开不依赖任何生产项目的通用 Remotion 占位 composition。实际项目必须按 Skill 的状态机完成 provider、概念、风格/虚构音色和素材质量门后才能预览或正式渲染。

## 创建新项目

```bash
npm run project:new -- silk-road --title="玄奘西行"
```

这会创建：

```text
projects/silk-road/
  assets-manifest.json
  brief.md
  planning-scenarios.json
  production.json
  project.json
  storyboard.json
  prompts.json
  providers.json
  quality-report.json
  requests/
  review.md

public/projects/silk-road/
  assets/style/
  assets/plates/
  assets/environment/rear/
  assets/environment/mid/
  assets/environment/foreground/
  assets/characters/source/
  assets/characters/alpha/
  audio/narration/
  audio/music/
  audio/sfx/
```

新项目先处于 `capability-review`。`project:intake` 用三张内置文生图风格卡收集画幅、视觉风格和视差偏好；风格卡在插件开发时一次生成并随包分发，用户选择时不调用 provider。`project:scenarios` 再用共同故事骨架比较轻量成片、均衡动画和完整纵深的时长、幕数、动作、分层、预计调用、建议 cap 和 hard ceiling，全程不调用 provider。选定方案后，Creative Plan v4 写入 scenario 指纹和 `profilePromise`，Storyboard v10 同时检查制作上限与质量下限。人一次确认 `scenarioDecision`、故事板、概念、精确 `sourcePackageDecision`、`budgetDecision.imageAttemptLimit` 和三类 provider 后，`project:confirm-concept` 才允许进入故事专属风格样张阶段。可以用 `--dry-run` 预览将创建的路径而不写文件：

```bash
npm run project:new -- silk-road --title="玄奘西行" --dry-run
```

## 项目命令

| 命令 | 作用 |
|---|---|
| `npm run project:new -- <slug>` | 创建人类简报、机器配置和素材目录 |
| `npm run project:intake -- <slug> --json` | 输出画幅、三张内置风格卡与视差偏好的初始选择 |
| `npm run project:scenarios -- <slug> --input=<file> --json` | 编译共同故事骨架和三档故事/制作/成本卡 |
| `npm run project:plan -- <slug> --scenario=<id>` | 将人选中的 scenario 锁定为 Creative Plan、预算上限和质量下限 |
| `npm run project:storyboard -- <slug> --input=<file>` | 编译并锁定 Storyboard v10 节拍 treatments、layer source packages、edit points、三画幅导演计划、高级切换、多维风格证明与证明时刻 |
| `npm run project:revise-preview-directing -- <slug> --input=<file>` | 在预览退回后保护概念/风格并按既定 motion budget 正式重编导演字段 |
| `npm run project:semantic-contracts -- <slug> --input=<file>` | 锁定人物身份、结构拓扑、功能机构、说明图和证明目标 |
| `npm run project:confirm-concept -- <slug> --input=<file>` | 一次记录概念、预算和 text/image/voice provider 决定 |
| `npm run project:resume -- <slug>` | 输出最小恢复状态、下一命令和未完成批次 |
| `npm run project:status -- <slug>` | 显示当前阶段、审批、产物和下一步 |
| `npm run project:status -- <slug> --compact-json` | 输出不含冗长历史的机器可读控制信息 |
| `npm run provider:status -- <slug> --compact-json` | 精简检查文本、生图、语音 provider 配置 |
| `npm run provider:select -- <slug> <capability> <provider-id>` | 记录人确认的 provider、作用域和宿主工具 |
| `npm run provider:run -- --request=<file>` | 运行用户配置的命令适配器并登记资产来源 |
| `npm run provider:record -- --request=<file>` | 登记宿主工具或手工导入的本地输出 |
| `npm run provider:request -- validate --request=<file>` | 只读校验请求并输出规范 provider/model invocation |
| `npm run provider:recover-record -- --request=<file> --attempt-id=<id>` | 从已计费成功但未落 manifest 的关闭尝试恢复一次登记 |
| `npm run provider:recover-rejected-source -- --spec=<file> [--check]` | 验证或登记 rejected 原始输出为只读 `recovery-source`；不改 attempt ledger、不增加额度 |
| `npm run provider:reuse -- --request=<file>` | 按 provider/model/输入指纹复用哈希有效的已有资产 |
| `npm run provider:attempt -- reserve --request=<file>` | 在宿主生图前原子预留一次批准额度并返回 attempt id |
| `npm run provider:attempt -- summary --project=<slug>` | 只读汇总生成尝试与计费状态 |
| `npm run project:handoff-check -- <slug>` | 旧客户端兼容检查；新 Skill 使用 `project:resume` 的 handoff 字段 |
| `npm run project:checkpoint -- <slug> <id> <status>` | 记录地点、人物、旁白或质检批次的可恢复进度 |
| `npm run project:asset-lifecycle -- <slug> --asset=<id> --status=<active|rejected|recovery-source> --reason=<原因>` | 保留溯源并明确资产是否进入当前质量分母 |
| `npm run project:review-sync -- <slug>` | 从生产状态重新生成 `review.md` 的审批摘要 |
| `npm run project:advance -- <slug> <action>` | 记录明确的审批或确定性阶段完成事件 |
| `npm run project:composition-proof -- <slug> [--force]` | 用无字幕 proof 输入和 `composition-proof` runtime surface 指纹增量生成关系/语义证明；字幕独立改动不清空资产/组合审核，`--force` 显式禁用全部证明缓存 |
| `npm run project:assets-ready -- <slug>` | 一次完成旁白同步、字幕、v10 composition/v9 editorial 校验、证明指纹与双质量门和阶段推进 |
| `npm run project:audio-calibration -- <slug> propose` | 为当前旁白与时间线生成带指纹的响度校准草案 |
| `npm run project:sync -- <slug>` | 低层恢复命令：用 ffprobe 写回真实旁白时长 |
| `npm run project:subtitles -- <slug>` | 低层恢复命令：同步或生成字幕时间 |
| `npm run project:quality -- <slug> record-batch --input=<file>` | 原子记录与哈希/组合指纹绑定的资产或组合语义检查 |
| `npm run project:validate -- <slug>` | 检查 v10 组合/源包、edit-point 帧映射、编辑原语、注册/支撑、场景交接、字幕和时长 |
| `npm run project:preview -- <slug>` | 校验后渲染 50% 预览，并生成报告 |
| `npm run project:render -- <slug>` | 校验后渲染正式成片，并生成报告 |
| `npm run project:report -- <slug>` | 对已有成片生成技术报告和关键帧联系表 |
| `npm run style:proof -- <slug>` | 用真实 v10 组合生成覆盖语义、注册深度家族、耦合关系与状态序列的 schema-v6 多目标样式证明 |
| `npm run sample:vox:verify` | 对 VOX 工程样片生成固定帧联系表，并校验媒体、边界、素材与 runtime 指纹 |
| `npm run doctor -- --ready` | 检查 Node、FFmpeg、ffprobe、npm 和 Python 图像依赖 |
| `npm run plugin:sync` | 从维护源重新生成插件 Skill 和轻量 Remotion 工作区模板 |
| `npm run dev` | 在 Remotion Studio 中打开通用开发 composition |
| `npm test` | 运行生产状态、静默工具恢复和记录同步回归测试 |
| `npm run check` | TypeScript 类型检查 |

`project:preview` 和 `project:render` 都遵循 fail-fast：素材或配置存在错误时不会开始昂贵渲染；警告会写入报告但不阻塞。
默认渲染并发会按可用 CPU 自动决定（最多 8 路）；若完整 Chrome 或受限环境在多页并发下不稳定，可设置正整数 `PAPER_COLLAGE_RENDER_CONCURRENCY=1`，用同一条命令以单路并发重试。

新项目仍受严格门控：概念/预算/provider 的组合决定未记录时不能生成样张，风格/虚构音色未确认时不能批量生产，预览未获人工批准时不能渲染正式成片。完整动作表见 [docs/workflow.md](docs/workflow.md)。

涉及人工决定的动作必须带 `--note="人的原话或明确结论"`；这样中断恢复时不会把技术通过误认为创意或发布批准。

## 自定义文本、生图和语音服务

工作区默认使用当前 Codex 宿主提供的文本、生图和虚构语音能力，不绑定厂商。配置按以下顺序深度合并：

1. `providers.json`：可共享的工作区默认值；
2. `providers.local.json`：本机覆盖，已加入 `.gitignore`；
3. `projects/<slug>/providers.json`：单项目覆盖。

Skill 不会只根据名称猜测能力存在：它先检查当前宿主的实际工具/Skill 元数据，再把检测到的候选、已有配置、手工导入和“我自己提供这个能力”与概念/预算放进一次确认。默认通过 `project:confirm-concept` 批量持久化；`provider:select` 只用于单项变更。恢复任务时只要已选宿主工具仍存在，就不重复询问。

复制 `providers.local.example.json` 为 `providers.local.json`，即可把任意 CLI、SDK 包装脚本或私有 API 接到 `command` adapter。配置只保存 `requiredEnv` 的变量名，API key 仍放在环境变量中。异步服务由用户的 adapter 自行提交和轮询；稳定接口是“读取请求 JSON、写入指定输出、退出码为 0”。

新图像请求使用 schema v7，同时声明组合绑定、语义风险和可验证输出面；layer-aware 请求还必须携带与故事板完全一致的 `layerPackageBinding`。provider-native sheet 的 chroma 格使用 `keyPlane={mode:"provider-native-observed",policyId:"flat-v1"}`：运行时先证明近似请求色形成单一、连续、边界覆盖充分且与前景分离的平面，再把观测色和统计指纹传给本地抠图。人物、复杂拓扑、功能机构和说明图先写入 `semantic-contracts.json`，再由 proof target 和证据型质量门验证；prompt 不作为验收依据。宿主生图先只读校验请求，再运行 `provider:attempt reserve` 并使用返回的规范 invocation；命令 adapter 由 `provider:run` 自动预留。所有可能计费的成功、废稿、拒绝和放弃结果写入只追加账本，预算用尽时下一次调用被阻断。

被接受的输出仍通过 `provider:run` 或 `provider:record` 写入 manifest v4，记录 provider、模型/任务 id、请求指纹、SHA-256、组合/语义绑定、母版/派生成员、源家族指纹和生命周期。未来被正式验证拒绝的输出同时记录文件哈希；已有 rejected 输出可由独立 recovery spec 核对原请求、账本、文件哈希和 observed key plane，并作为 `recovery-source` 登记。该操作不重写/追加 ledger，也不把 rejected attempt 改成 succeeded。替换记录保留为 `superseded`；`rejected` 与 `recovery-source` 保留审计但不进入当前质量分母。相同 provider、模型、输入、设置和完整绑定才允许 `provider:reuse`；图像仍需在当前项目通过质量检查。完整契约见 [Provider Configuration](skills/make-paper-collage-video/references/providers.md) 和 [Semantic Production Contracts](skills/make-paper-collage-video/references/semantic-contracts.md)。

## 角色素材表处理

一条命令完成四宫格拆分、软蒙版、通用去色键溢色和透明 PNG 输出。色键可自动从边框采样，也可以显式指定；选用服装中没有的高饱和颜色，不必固定为绿色：

```bash
npm run assets:process-sheet -- \
  public/projects/my-project/assets/characters/source/scene-sheet-green.png \
  public/projects/my-project/assets/characters/source \
  public/projects/my-project/assets/characters/alpha \
  scene 4 \
  --columns=2 \
  --key-color=auto \
  --matte-erode=1 \
  --names=emperor,maid-left,maid-right,officials
```

底层脚本仍可独立使用：

```bash
python3 scripts/split_sheet.py INPUT OUTPUT_DIR PREFIX COUNT --columns 2
python3 scripts/remove_chroma_key.py --input KEY.png --out ALPHA.png --key-color=auto --matte-erode=1 --force
```

## 项目协议

项目配置遵循 [schemas/project.schema.json](schemas/project.schema.json)。核心结构包括：

- `video`：宽高和帧率。
- `quality`：强制质量门使用的最低素材分辨率比例。
- `theme`：纸张、字幕、描边和前景颜色。
- `voice`：虚构音色或后续可选的克隆音色元数据。
- `audio`：旁白、背景音乐和必填 LUFS/true-peak 交付规格。
- `scenes`：故事板蓝图、带断言的证明时刻、递归 `composition` 树、本地 keyframe、旁白、逐节拍持久/短暂/声音事件和字幕。
- `sceneTransitions`：每对相邻场景唯一的交接契约。`intent` 只声明 `continuity | location-change | time-passage | focus-reveal | chapter-reset | impact` 叙事意图，`treatment` 独立声明执行方式。普通意图默认路由到注册纸张转场，也可用绑定边界节拍的 `motivation=rhythmic` 硬切；`impact` 则使用 `motivation=impact` 硬切。
- `camera.parallax` 与节点 `depth=-1..1`：由同一镜头运动确定性驱动背景/焦平面/前景差速，不接受没有实际镜头运动或没有景深层次的伪视差。
- `motif-field`：用一个带固定 `seed`、安全区、数量上限、分布和内部运动的节点展开重复装饰素材，无需手写几十个图片节点。

镜头时长不是人工填写的常量，而是：

```text
round(旁白开始秒数 × fps) + ceil(真实旁白秒数 × fps) + ceil(尾部留白秒数 × fps)
```

动画边界按 `sceneTransitions[].treatment.durationSeconds` 交叠，且只能在硬裁剪、完整不透明入场画面或完全不透明的纸色遮罩下交接。`cut` 必须明确为 `rhythmic` 或 `impact`；rhythmic cut 还必须绑定出场末段或入场开段的 `beatId`。项目作者只写秒数和归一化的节拍/关键帧位置；帧数由渲染器根据 fps 推导。旧字段不会被迁移或猜测。

生产状态遵循 [schemas/production.schema.json](schemas/production.schema.json)。它是断点恢复协议，不是创意配置：记录 `stage`、审批、粗粒度生产批次、产物和追加式事件历史。默认路径用组合故事板/概念/provider 确认、风格确认和预览确认。不要直接改状态 JSON。

`project:resume` 只输出当前阶段、制作档位、控制模式、下一命令、未完成批次和 handoff 决定。只有 `WAIT-HUMAN` 可以作为正常暂停点；`AUTO-CONTINUE` 的真实阻塞必须报告确切错误和唯一必要的人为动作。

## 验收

`project:validate` 检查：

- 项目协议、slug、视频规格和唯一 id。
- 递归节点、注册画布、支撑槽位/接触区、环境边界/mask、旁白、音乐、音效和纸张纹理是否存在且一致。
- 人物 PNG 是否真的有透明区域。
- 优先读取清边处理报告声明的真实色键，检查可见半透明边缘是否仍有对应溢色；只有无报告且透明 RGB 明显高饱和时才回退推断。清边输出同时执行 despill 和透明 RGB edge padding，避免缩放采样把原色键混回边缘。
- 非注册场景素材是否达到输出规格；注册成员和 mask 是否与母版画布完全一致。
- 旁白配置时长是否等于 ffprobe 实测时长。
- 项目逐幕蓝图、组合模式、证明 id/时刻/断言是否与已批准故事板一致。
- 组与子节点关键帧是否覆盖完整镜头，每个故事节拍是否有有效事件目标、正确显隐生命周期和证明窗口。
- 每对相邻场景是否恰好有一条边界，叙事意图与执行 treatment 是否正交且合法，rhythmic cut 是否绑定边界节拍，动画边界的出场 tail/入场旁白 lead 是否覆盖完整转场。
- 启用视差的镜头是否有可见 camera 运动、至少两个 depth 层级且耦合组仅由 group 承载景深；motif-field 是否有固定 seed、受限数量、合法变化范围、画布内 bounds、标题/人脸/数据排除区、闭合循环与单镜头总预算。
- 字幕范围、重叠、越界、单条长度和阅读速度。
- 支撑主体在各证明时刻是否仍位于接触区，注册环境是否只声明一次语义区域。

`project:quality` 同时检查单文件和跨文件组合；文件哈希变化使资产审查失效，成员、mask、变换、环境边界、事件、场景交接或证明变化使对应组合审查失效。`project:report` 继续检查成片编码、分辨率、帧率、音轨、响度/峰值，并纳入事件时间线、场景边界联系表和真实组合证明摘要。

## 历史项目

仓库中的旧演示成片及其旧项目数据只保留为历史制作记录，当前运行时不会迁移或执行它们。插件发行包只携带符合 v9 的独立 `starter-demo` 技术夹具。

## 贡献、支持与安全

- 参与开发前阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。
- 使用问题和支持边界见 [SUPPORT.md](SUPPORT.md)。
- 漏洞请按 [SECURITY.md](SECURITY.md) 私密报告，不要创建公开 Issue。
- 社区参与需要遵守 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)。
- 版本变化记录在 [CHANGELOG.md](CHANGELOG.md)。
- 维护者发布新版本时遵循 [docs/releasing.md](docs/releasing.md)。

## 许可与第三方条款

源码、脚本、Schema、模板、测试和文档采用 [MIT License](LICENSE)。仓库技术夹具、纸张纹理及其衍生媒体明确排除在 MIT 之外，只授予随本仓库或插件运行、测试、评审和演示所必需的有限权限；不得抽取为素材包、用于其他作品或商业产品、训练模型、再许可或出售。详见 [ASSET_LICENSES.md](ASSET_LICENSES.md)。

本项目依赖 Remotion，其特殊许可证在部分公司使用场景下要求购买 Company License。项目自己的许可证不会修改或替代 Remotion、FFmpeg、React、Sharp、NumPy、Pillow、外部生成服务或其他第三方组件的条款。详见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
