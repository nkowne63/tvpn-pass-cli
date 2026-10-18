// V_PATTERN を、乱数表（3 ブロック × 4 行 × 4 列、計 48 マス）のマス番号の列に変換する。
//
// 受け付ける形:
// - カンマ区切りのマス番号: "0,1,5,6"
// - 乱数表の格子: 4 行、各行は空白区切りの 3 ブロック（各 4 文字）。数字は入力する順番（1 文字 1 マス）、
//   それ以外の文字（* など）は使わないマス。例:
//     12** **** ****
//     **34 **** ****
//     **** **** ****
//     **** **** ****
//   マス番号はブロック b・行 r・列 c について b*16 + r*4 + c。
export function parsePattern(value) {
    if (!value) throw new Error('V_PATTERN is empty')
    const text = value.trim()
    if (/^\d+(\s*,\s*\d+)*$/.test(text)) {
        return text.split(',').map(s => Number(s.trim()))
    }

    const rows = text.split(/\r?\n/)
    if (rows.length !== 4) throw new Error(`V_PATTERN grid must have 4 rows, got ${rows.length}`)
    const cells = []
    rows.forEach((row, r) => {
        const blocks = row.trim().split(/\s+/)
        if (blocks.length !== 3 || blocks.some(b => b.length !== 4)) {
            throw new Error(`V_PATTERN grid row ${r + 1} must be 3 blocks of 4 characters`)
        }
        blocks.forEach((block, b) => {
            [...block].forEach((ch, c) => {
                if (/\d/.test(ch)) cells.push({ order: Number(ch), index: b * 16 + r * 4 + c })
            })
        })
    })
    cells.sort((a, b) => a.order - b.order)
    if (cells.length === 0 || cells.some((cell, i) => cell.order !== i + 1)) {
        throw new Error('V_PATTERN grid digits must be 1..n, each used once')
    }
    return cells.map(cell => cell.index)
}
