// Deterministic demo rules, not model-based intent recognition.
export function messageIntents(
  text,
  { open = false, waitingInput = false } = {},
) {
  const parts = text
    .split(
      /\n|[；;]|(?<=[。！？!?])\s*|[，,]?\s*(?:并且|同时|并)(?=解释|说明|回答|完成后|做完后|之后再)|[，,](?=\s*(?:完成后|做完后|之后再))/u,
    )
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.map((part) => {
    const queued = part.match(
      /^(?:完成(?:当前工作|这件事)?后|做完(?:当前工作|这件事)?后|之后|然后)\s*(?:请|再)?\s*(.+)/u,
    );
    if (queued) return { kind: "queue", text: queued[1] };
    const replacement = part.match(
      /^(?:不要.+?[，,]?\s*(?:改成|改为|改做|换成)|改做|换个目标[：:]?)\s*(.+)/u,
    );
    if (replacement) return { kind: "replace", text: replacement[1] };
    if (/^(?:请)?(?:停下|停止|停一下|先停|别做了)/u.test(part))
      return { kind: "stop", text: part };
    if (
      /[？?]$/u.test(part) ||
      /^(?:请)?(?:解释|说明|回答|为什么|为何|怎么|如何|依据是什么|这个数字的?依据)/u.test(
        part,
      )
    )
      return { kind: "question", text: part };
    if (
      /^(?:请)?(?:继续修改|修改|调整|补充|重点|改短|缩短|加上|增加|删去|删除这段|保留|简洁|报告再短|再短|短一点|用.+?替代|不连接工作区)/u.test(
        part,
      )
    )
      return { kind: "steer", text: part };
    if (waitingInput) return { kind: "answer", text: part };
    if (
      /^(?:请)?(?:帮我|整理|写|生成|制作|做一|分析|比较|读取|检查|统计|总结|研究|创建)/u.test(
        part,
      )
    )
      return { kind: open ? "queue" : "start", text: part };
    return { kind: open ? "clarify" : "start", text: part };
  });
}
