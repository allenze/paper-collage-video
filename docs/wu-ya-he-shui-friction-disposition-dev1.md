# 《乌鸦喝水》可复用摩擦处置（dev.1）

日期：2026-07-30
来源：已结束的外部生产项目 `wu-ya-he-shui-v2`；本次不修改、不恢复、也不继续
该项目。

## 本批处置

| 生产现象 | 责任边界 | 通用处置 |
|---|---|---|
| 瓶子、水体和小水面是多个相互错位或遮盖的素材 | Skill/runtime 架构缺口 | 新增一等 `canonical-container`，只允许 clean plate、contents、canonical frame 三个权威槽。 |
| 调整水层坐标只能暂时改善一帧 | 项目修补暴露通用缺口 | 所有状态改由同一状态表、同一注册画布和同一内腔 polygon 派生；局部位移只允许在可量化阈值内自动纠正。 |
| 内容状态可能重画瓶体或额外水面 | Provider/authoring 合同缺口 | 三个 provider root 使用互斥角色指令；contents sheet 明确禁止瓶体、前框、背景及额外 surface。 |
| 最后水位没有充满到目标高度 | 质量/证明缺口 | 每个状态记录 fill/rim/bottom/retention/overflow 指标；终态必须满足最小填充、最大瓶口间隙和底部覆盖。 |
| 一个失败水位可能诱发单格重生或新增贴图 | 恢复策略缺口 | 先确定性重处理；需要新像素时只允许保留完整状态表上下文的 mask edit，否则整表重生；禁止孤立状态生成。 |

## 不属于本批的事项

乌鸦飞行动作和朝向已由现有 state-sequence、`gait` 和
`travel-facing` 能力覆盖，并在此前的通用 locomotion 修复中处理。本批不为
已关闭项目重生素材或重渲染视频，也不把一次性坐标修补保留为正式方案。

## 关闭条件

只有 authoring/schema/provider/派生/runtime/validator/proof/quality/fingerprint/
tests/docs、packaged plugin、installed cache 和全新 installed-cache 工作区使用
同一合同并通过验证后，本批摩擦才标记关闭。项目预览本身不是通用能力的关闭
证据。

## 关闭结果

本批于 2026-07-30 关闭。源码 252/252、全新 installed-cache 工作区
236/236（零跳过）通过，doctor 为 READY，TypeScript 与 Schema v11 通过。
source、packaged plugin、installed cache 和 fresh workspace 使用同一 runtime
fingerprint：
`5990c23e246e13309412d255d3f738d7ab95efebf57e1e2eea32b1bcad6ff097`。
已结束的 `wu-ya-he-shui-v2` 未被修改，也没有为了验证而恢复或重渲染。
