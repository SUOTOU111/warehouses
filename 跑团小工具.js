// ==UserScript==
// @name         跑团工具箱
// @author       锁头（3229622745）
// @version      1.0
// @description  整合版跑团工具箱（属性检定+伤害计算+线索板）
// @license      MIT
// @timestamp    2025-8-13
// ==/UserScript==

/* 
功能说明：

=== COC7属性隐藏检定 ===
.rl <技能/数值>      // 隐藏属性检定（显示出目），例如.rl斗殴
.re <技能/数值>  // 隐藏属性检定（不显示出目，仅显示成功等级），例如.re斗殴

=== 伤害表达式管理器 ===
.damage add <名称> <表达式>  // 添加伤害表达式，例如.damage add 降龙十八掌 1d6+2d8+9d9
.damage roll <名称>         // 执行伤害表达式，例如.damage roll 降龙十八掌
.damage list               // 查看所有表达式，例如.damage list
.damage del <名称>         // 删除表达式，例如.damage del 降龙十八掌
.d <表达式名称>             // 快捷执行表达式，例如.d降龙十八掌

=== 线索板管理器 ===
.记录线索【组别】 线索内容     // 记录线索，例如.记录线索【团A】这里有一只小鸡
.看线索板                    // 查看所有线索
.看线索板【组别】            // 查看指定团线索，例如.看线索板【团A】
.清空线索板【组别】          // 清空指定组别线索，例如.清空线索板【团A】
*/

// ==================== COC7属性隐藏检定 ====================
const resultTexts = {
    大成功: "【大成功】\n（你的自定义大成功描述）",
    成功_极难: "【极难成功】\n（你的自定义极难成功描述）",
    成功_困难: "【困难成功】\n（你的自定义困难成功描述）",
    成功_普通: "【成功】\n（你的自定义普通成功描述）",
    失败: "【失败】\n（你的自定义失败描述）",
    大失败: "【大失败】\n（你的自定义大失败描述）"
};

function makecheck(check, dice) {
    let result = "";

    if (check <= 95) {
        if (dice <= 5) result = resultTexts.大成功;
        else if (dice <= check / 5) result = resultTexts.成功_极难;
        else if (dice <= check / 2) result = resultTexts.成功_困难;
        else if (dice <= check) result = resultTexts.成功_普通;
        else if (dice >= 96) result = resultTexts.大失败;
        else result = resultTexts.失败;
    }
    else if (check <= 100) {
        if (dice <= 5) result = resultTexts.大成功;
        else if (dice <= check / 5) result = resultTexts.成功_极难;
        else if (dice <= check / 2) result = resultTexts.成功_困难;
        else if (dice <= check) result = resultTexts.成功_普通;
        else result = resultTexts.大失败;
    }
    else {
        if (dice <= 5) result = resultTexts.大成功;
        else if (dice <= check / 5) result = resultTexts.成功_极难;
        else if (dice <= check / 2) result = resultTexts.成功_困难;
        else result = resultTexts.成功_普通;
    }
    return result;
}

// ==================== 伤害表达式管理器 ====================
const CustomRollsStorage = {};

function ensureRollStorage(userId) {
    if (!CustomRollsStorage[userId]) {
        CustomRollsStorage[userId] = {};
    }
    return CustomRollsStorage[userId];
}

// ==================== 线索板管理器 ====================
const ClueBoardStorage = {};

function ensureClueStorage(userId) {
    if (!ClueBoardStorage[userId]) {
        ClueBoardStorage[userId] = {};
    }
    return ClueBoardStorage[userId];
}

// ==================== 主插件 ====================
let ext = seal.ext.find('跑团工具箱');
if (!ext) {
    ext = seal.ext.new('跑团工具箱', '锁头', '1.0');
    seal.ext.register(ext);
}

// ==================== 公共工具函数 ====================
function extractGroup(message) {
    const match = message.match(/【(.*?)】/);
    return match ? match[1] : null;
}

// ==================== COC7命令实现 ====================
const cmdrl = seal.ext.newCmdItemInfo();
cmdrl.name = 'rl';
cmdrl.help = '随机掷骰：.rl [面数]（默认100面）例：.rl 或 .rl80';
cmdrl.solve = (ctx, msg, cmdArgs) => {
    const mctx = seal.getCtxProxyFirst(ctx, cmdArgs);
    let diceFaces = 100;

    let inputStr = "";
    for (let i = 1; i <= 5; i++) {
        const arg = cmdArgs.getArgN(i);
        if (arg) inputStr += arg;
    }

    const numMatch = inputStr.match(/\d+/);
    if (numMatch) {
        diceFaces = Math.min(Math.max(1, parseInt(numMatch[0])), 10000);
    }

    const diceResult = parseInt(seal.format(mctx, `{1d${diceFaces}}`)) || 1;

    seal.replyToSender(mctx, msg,
        `${seal.format(mctx, '{$t玩家}')}的掷骰（D${diceFaces}）：${diceResult}`
    );
    return seal.ext.newCmdExecuteResult(true);
};

const cmdcheck = seal.ext.newCmdItemInfo();
cmdcheck.name = 're';
cmdcheck.help = '隐藏属性检定：.re <技能> 例：.re 侦查';
cmdcheck.solve = (ctx, msg, cmdArgs) => {
    const mctx = seal.getCtxProxyFirst(ctx, cmdArgs);
    const args = [];

    for (let i = 1; i <= 10; i++) {
        const arg = cmdArgs.getArgN(i);
        if (arg) args.push(arg);
    }

    let checkValue, displayText;

    if (args.length === 0) {
        seal.replyToSender(ctx, msg, "格式：.re <技能> 或 .re <数值>");
        return seal.ext.newCmdExecuteResult(true);
    }

    // 参数解析逻辑
    const combined = args.join('');
    const match = combined.match(/^([^\d]+)(\d+)$/);

    if (match) {
        displayText = match[1].trim();
        checkValue = parseInt(match[2]);
    } else if (!isNaN(combined)) {
        checkValue = parseInt(combined);
        displayText = "数值";
    } else {
        displayText = args.join(' ');
        checkValue = seal.format(mctx, `{${displayText}}`);
    }

    const diceResult = parseInt(seal.format(mctx, '{1d100}'));
    const result = makecheck(checkValue, diceResult);

    seal.replyToSender(mctx, msg,
        `${seal.format(mctx, '{$t玩家}')}的${displayText}检定：${result}`
    );
    return seal.ext.newCmdExecuteResult(true);
};

// ==================== 伤害表达式命令实现 ====================
const addExpression = (ctx, msg, cmdArgs) => {
    const name = cmdArgs.getArgN(2);
    let expr = "";

    for (let i = 3; i <= cmdArgs.args.length; i++) {
        const arg = cmdArgs.getArgN(i);
        if (arg) {
            if (expr) expr += " ";
            expr += arg;
        }
    }

    if (!name || !expr) {
        seal.replyToSender(ctx, msg, "格式: .damage add <名称> <表达式>\n例: .damage add 斩击 2d10+5");
        return;
    }

    const userId = msg.sender.userId;
    try {
        const userStorage = ensureRollStorage(userId);
        userStorage[name] = expr;
        seal.replyToSender(ctx, msg, `✅ [${name}] 已保存: ${expr}`);
    } catch (e) {
        seal.replyToSender(ctx, msg, "❌ 保存失败，请检查控制台日志");
    }
};

const rollExpression = (ctx, msg, name) => {
    if (!name) {
        seal.replyToSender(ctx, msg, "需要指定表达式名称\n例: .damage roll 斩击");
        return;
    }

    const userId = msg.sender.userId;
    try {
        const userStorage = CustomRollsStorage[userId] || {};
        const expr = userStorage[name];

        if (!expr) {
            seal.replyToSender(ctx, msg, `❌ 未找到: ${name}\n使用 .damage list 查看可用表达式`);
            return;
        }

        const result = seal.format(ctx, `{${expr}}`);
        const playerName = seal.format(ctx, '{$t玩家}');
        seal.replyToSender(ctx, msg, `${playerName}的[${name}] ${expr}=${result}`);
    } catch (e) {
        seal.replyToSender(ctx, msg, `❌ 执行错误: ${e.message}\n请检查表达式是否正确`);
    }
};

const listExpressions = (ctx, msg) => {
    const userId = msg.sender.userId;
    try {
        const userStorage = CustomRollsStorage[userId] || {};
        const expressions = Object.keys(userStorage);

        if (expressions.length === 0) {
            seal.replyToSender(ctx, msg, "尚未存储任何表达式\n使用 .damage add 添加");
            return;
        }

        let text = "你的伤害表达式:\n";
        for (const name of expressions) {
            text += `[${name}] ${userStorage[name]}\n`;
        }

        seal.replyToSender(ctx, msg, text);
    } catch (e) {
        seal.replyToSender(ctx, msg, `❌ 列出表达式失败: ${e.message}`);
    }
};

const deleteExpression = (ctx, msg, name) => {
    if (!name) {
        seal.replyToSender(ctx, msg, "需要指定删除的名称\n例: .damage del 斩击");
        return;
    }

    const userId = msg.sender.userId;
    try {
        const userStorage = ensureRollStorage(userId);

        if (!userStorage[name]) {
            seal.replyToSender(ctx, msg, `❌ 未找到: ${name}`);
            return;
        }

        delete userStorage[name];
        seal.replyToSender(ctx, msg, `已删除: ${name}`);
    } catch (e) {
        seal.replyToSender(ctx, msg, `❌ 删除失败: ${e.message}`);
    }
};

const cmdDamage = seal.ext.newCmdItemInfo();
cmdDamage.name = 'damage';
cmdDamage.help = '伤害表达式管理器';
cmdDamage.solve = (ctx, msg, cmdArgs) => {
    const subCmd = cmdArgs.getArgN(1);

    switch (subCmd) {
        case 'add':
            addExpression(ctx, msg, cmdArgs);
            break;
        case 'roll':
            rollExpression(ctx, msg, cmdArgs.getArgN(2));
            break;
        case 'list':
            listExpressions(ctx, msg);
            break;
        case 'del':
        case 'delete':
            deleteExpression(ctx, msg, cmdArgs.getArgN(2));
            break;
        default:
            const help = `伤害表达式管理器 v9.2
添加: .damage add <名称> <表达式>
执行: .damage roll <名称>
列表: .damage list
删除: .damage del <名称>
快捷掷骰: .d <表达式名称>

注意: 
1. 表达式名称不能包含空格
2. 表达式支持海豹骰子所有语法`;
            seal.replyToSender(ctx, msg, help);
    }
    return seal.ext.newCmdExecuteResult(true);
};

const cmdShortcut = seal.ext.newCmdItemInfo();
cmdShortcut.name = 'd';
cmdShortcut.help = '快捷执行伤害表达式';
cmdShortcut.solve = (ctx, msg, cmdArgs) => {
    const name = cmdArgs.getArgN(1);
    if (!name) {
        seal.replyToSender(ctx, msg, "格式: .d <表达式名称>\n例: .d 斩击");
        return seal.ext.newCmdExecuteResult(true);
    }
    rollExpression(ctx, msg, name);
    return seal.ext.newCmdExecuteResult(true);
};

// ==================== 线索板命令实现 ====================
const cmdAddClue = seal.ext.newCmdItemInfo();
cmdAddClue.name = '记录线索';
cmdAddClue.help = '记录线索: .记录线索【组别】 线索内容';
cmdAddClue.solve = (ctx, msg) => {
    const content = msg.message.trim();
    const group = extractGroup(content);

    if (!group) {
        seal.replyToSender(ctx, msg, '❌ 格式错误！请使用: .记录线索【组别】 线索内容');
        return seal.ext.newCmdExecuteResult(true);
    }

    const clueStart = content.indexOf('】') + 1;
    const clueContent = content.slice(clueStart).trim();

    if (!clueContent) {
        seal.replyToSender(ctx, msg, '❌ 线索内容不能为空！');
        return seal.ext.newCmdExecuteResult(true);
    }

    try {
        const userId = msg.sender.userId;
        const userStorage = ensureClueStorage(userId);

        if (!userStorage[group]) {
            userStorage[group] = [];
        }

        userStorage[group].push(clueContent);
        seal.replyToSender(ctx, msg, `✅ 已记录到【${group}】线索板`);
    } catch (e) {
        seal.replyToSender(ctx, msg, `❌ 记录失败: ${e.message}`);
    }
    return seal.ext.newCmdExecuteResult(true);
};

const cmdViewClue = seal.ext.newCmdItemInfo();
cmdViewClue.name = '看线索板';
cmdViewClue.help = '查看线索: .看线索板 [【组别】]';
cmdViewClue.solve = (ctx, msg) => {
    const content = msg.message.trim();
    const group = extractGroup(content);
    const userId = msg.sender.userId;
    const userStorage = ClueBoardStorage[userId] || {};

    try {
        if (group) {
            const clues = userStorage[group];
            if (!clues || clues.length === 0) {
                seal.replyToSender(ctx, msg, `【${group}】线索板为空`);
                return seal.ext.newCmdExecuteResult(true);
            }

            let result = `📜【${group}】线索板:\n`;
            clues.forEach((clue, index) => {
                result += `${index + 1}. ${clue}\n`;
            });
            seal.replyToSender(ctx, msg, result);
        } else {
            const groups = Object.keys(userStorage);
            if (groups.length === 0) {
                seal.replyToSender(ctx, msg, '你的线索板为空');
                return seal.ext.newCmdExecuteResult(true);
            }

            let result = '📜 你的线索板:\n';
            groups.forEach(group => {
                const clues = userStorage[group];
                result += `\n【${group}】:\n`;
                clues.forEach((clue, index) => {
                    result += `  ${index + 1}. ${clue}\n`;
                });
            });
            seal.replyToSender(ctx, msg, result);
        }
    } catch (e) {
        seal.replyToSender(ctx, msg, `❌ 查看失败: ${e.message}`);
    }
    return seal.ext.newCmdExecuteResult(true);
};

const cmdClearClue = seal.ext.newCmdItemInfo();
cmdClearClue.name = '清空线索板';
cmdClearClue.help = '清空线索: .清空线索板【组别】';
cmdClearClue.solve = (ctx, msg) => {
    const content = msg.message.trim();
    const group = extractGroup(content);

    if (!group) {
        seal.replyToSender(ctx, msg, '❌ 为避免误删全部线索，请使用: .清空线索板【组别】');
        return seal.ext.newCmdExecuteResult(true);
    }

    try {
        const userId = msg.sender.userId;
        const userStorage = ensureClueStorage(userId);

        if (userStorage[group]) {
            delete userStorage[group];
            seal.replyToSender(ctx, msg, `✅ 已清空【${group}】线索板`);
        } else {
            seal.replyToSender(ctx, msg, `❌ 【${group}】线索板不存在或已为空`);
        }
    } catch (e) {
        seal.replyToSender(ctx, msg, `❌ 清空失败: ${e.message}`);
    }
    return seal.ext.newCmdExecuteResult(true);
};

// ==================== 注册所有命令 ====================
ext.cmdMap['rl'] = cmdrl;
ext.cmdMap['re'] = cmdcheck;
ext.cmdMap['damage'] = cmdDamage;
ext.cmdMap['d'] = cmdShortcut;
ext.cmdMap['记录线索'] = cmdAddClue;
ext.cmdMap['看线索板'] = cmdViewClue;
ext.cmdMap['清空线索板'] = cmdClearClue;

console.log("跑团工具箱插件初始化完成");