# VOX Phase 2.2：素材族与透明边缘生产加固

## 范围与结论

本阶段只修复 Phase 2.1 审计中的 F035 与 F037，不制作最终参考样片，也不调用图片、语音或视频 provider。实现把两项能力做成仓库与打包插件共享的纵向切片，并将 executable identity 提升到 `0.16.0-dev.3`。

## F035：一等 registered-family 派生

`schemas/registered-family.schema.json` 是 authoring 输入；`schemas/registered-family-binding.schema.json` 是 manifest/quality provenance 输出。正式入口为：

```bash
npm run assets:derive-registered-family -- projects/<slug>/registered-families/<family>.json
```

一个 spec 恰好声明 `support-rear`、`subject`、`support-front`。每个成员绑定 asset/node/role/slot、同一 registration、source master、完整 canvas/top-left origin、可选 placement/mask/clip，以及固定的 `preserve-family-context` 恢复策略。来源只能是：

- 已登记且尺寸、registration、source master 都匹配的完整 source master；
- 带 `stateSheetBinding` 的 registered sheet 中一个声明 cell；
- 由正式 state-sheet processor 登记、保留 source-sheet lineage 与 family fingerprint 的成员。

非完整来源必须显式给出其在完整注册画布中的 placement；没有 lineage 或 placement 的裁紧独立图会被拒绝，不能通过补字段伪装成共享注册画布。

派生结果由 CLI 自动写入 manifest v4，adapter 为 `registered-family-member`。同 asset id 的旧 active 记录变为 `superseded`，新记录为 `active`；role/slot/node/source hash/mask hash/clip/placement/canvas-preserved/recovery/family fingerprint 都由运行时生成。`applyToProject=true` 时 CLI 只更新已经存在且 role/slot/node id 匹配的 `supported-subject` 资产节点，不要求操作者逐条补 manifest。

质量目标与项目验证要求三个 active 成员形成一个完整 family、尺寸等于注册画布、source master 和 registration 一致、角色与节点一致。运行时继续直接消费标准 `supported-subject` group；authoring CLI 生成的节点路径无需 renderer 专用分支。

## F037：低 alpha 矩形裁切带检测

`scripts/alpha-band-lib.mjs` 在原始分辨率和实际 proof/render 缩放后执行相同检测。默认阈值：

| 参数 | 默认值 |
|---|---:|
| low alpha | 4–96 |
| 最短连续带 | 24 px |
| 最短轴向比例 | 42% |
| 未关联长带 warning 比例 | 75% |
| thin band 最大厚度 | cross-axis 的 2.5% |
| 边界关联容差 | cross-axis 的 1.2%，且至少 2 px |
| 矩形两边最小间隔 | 对应轴的 8% |

检测先逐行/逐列找最长低 alpha run，再合并相邻且重叠的扫描线。候选会关联：

- 画布边界；
- registered-family placement 边界；
- rectangle clip/crop 边界；
- 四条相容直边组成的矩形。

四边矩形和边界关联 thin band 是 error；很长但未关联的直带是 warning；普通曲线轮廓是 info；超过厚度阈值的宽软过渡归类为纸张阴影/soft transition，不作为矩形残留失败。报告给出 scale、方向、坐标区间、span、厚度、边界关联、分类、严重级别和可读失败信息。

`project:validate` 用独立错误码 `composition-rectangular-alpha-band` 阻断异常前景。`project:quality` 加入 `rectangular-alpha-band-free`，而 composition/style proof 为每个耦合资产写出：

- alpha mask；
- checkerboard；
- tight crop；
- motion-stress；
- `*-alpha-bands.json`；
- `*-alpha-bands.png`。

后三种人工语义证据继续保留；`key-edge-clean` 只检查色键/软 matte 污染，不能替代矩形裁切带检测。

## Proof 与验证矩阵

| 能力 | synthetic | project/quality | runtime proof | packaging |
|---|---|---|---|---|
| F035 完整三成员派生 | source master、mask、tight-image reject、repeat/supersede | family binding、role/slot/node、canvas、provenance | Phase 2 的 16:9、9:16、1:1 Chromium frame/crop | source/package/fresh cache |
| F037 正常负例 | 曲线主体 + 纸张软阴影应通过 | project error code 与 quality technical check | 每个 F035 成员按实际三画幅尺寸重采样 | source/package/fresh cache |
| F037 普通正例 | 内部矩形低 alpha 残留应失败 | crop/derivation correlation | JSON + overlay | source/package/fresh cache |
| F037 extreme | 贴近画布边缘的 1 px 低 alpha 矩形应失败 | canvas correlation | source + render scale | source/package/fresh cache |

正式无 provider 入口：

```bash
npm run proof:registered-family
npm run proof:alpha-bands
npm run proof:phase2
```

F035 报告中的 `providerImageCalls`、`localDerivatives` 与 `avoidedCalls` 从 active manifest lineage 计算。当前本地 proof 的 source master 也是确定性本地 fixture，因此真实值为 `0 / 3 / 3`，没有把 fixture 伪报成 provider 调用。

## Production pilot 仍需观察

- 不规则真实纸纤维、扫描噪点和极淡投影可能需要在不降低当前 fail-closed 边界的前提下校准阈值；pilot 应保留原图、缩放图和诊断坐标。
- provider 生成的复杂 source master 是否能稳定被 mask/segmentation 分成三层，仍取决于真实素材语义；确定性派生只能证明 canvas、lineage 和边缘，不替代人体/物件完整性审核。
- complete-source masked repair 是否能让具体 provider 保持未编辑区域逐像素不变，需要在获批的 production pilot 中按真实 connector 能力验证；本阶段没有调用 provider。
- 三画幅 proof 能证明 runtime 消费、缩放检测与技术契约，但不是最终影片的创意、叙事或生产发布批准。
