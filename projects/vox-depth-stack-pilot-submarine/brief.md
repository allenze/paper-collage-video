# 项目简报：海草间的黄色潜水艇

## 受控 pilot 意图

- 主题：一艘完整的黄色纸片潜水艇从前景海草后方横向穿过。
- 受众：内部 production-capability 审查。
- 平台和画幅：同时验证 16:9、9:16、1:1；主工作画布为 1920×1080、30 fps。
- 目标时长：内容推断为 6 秒。
- 目标幕数：用户明确指定 1 幕。
- 核心观点：相对景深运动必须由完整 rear、完整 subject 和完整 front 组成，不能从扁平参考图抠取可见碎片。
- 视觉气质：原创、无文字、无品牌的手工纸片拼贴；深蓝海水、黄色潜水艇、青绿色海草。
- 声音：voice provider 0；video provider 0。规划阶段仅复用确定性本地音频夹具作为 editorial timebase，不生成声音。
- 单一视觉风险：前景移开时，被遮挡的潜水艇下船体、尾鳍和螺旋桨必须完整，后方海底必须连续。
- 语义风险：topology-critical，仅验证轮廓与负空间，不声明真实潜水艇机械工作原理。
- Source strategy：一张 registered 2×2 layer sheet，包含组合参考、clean rear plate、full subject silhouette、full front overlay。
- Production profile：draft；正式单幕 ceiling 为 6，但本 pilot 的用户授权上限为 2 次图片 provider attempts。
- Provider 提案：gpt-image；正式 tool/model 与成本在 provider 调用前审批表中确认。
- 权利边界：仅原创虚构图形；不得出现人物、现成 IP、商标、标识或第三方受保护素材。
- 禁止做法：不得从扁平参考图反向遮罩出三层；不得 isolated family-member generation；不得在未审批前预留或调用 provider。

## 状态说明

审批状态由 `production.json` 统一维护，并自动同步到 `review.md`。不要在简报中重复记录会过期的流程状态。
