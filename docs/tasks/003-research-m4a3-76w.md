# 003-research-m4a3-76w:M4A3(76)W 数据调研(只出数据和出处)

- 负责:Claude Code(原定 Gemini CLI;2026-09-29 负责人决定本轮由 Claude Code 代做)
- 状态:待审查
- 分支:`task/003-research-m4a3-76w`
- 规模:M(只写文档,不写代码)

## 目标

为以后加入 M4A3(76)W 谢尔曼准备一份**每个数字都带出处**的数据表,格式对齐 `src/data/types.ts` 的 `VehicleSpec` / `ShellSpec` / `WeaponSpec` / `InternalsSpec`。这次只调研,不建模、不改 `src/`,用来检验数据质量。

## 背景与参考

- `src/data/vehicles.ts` 里虎式、T-34-85 的写法和注释(包括「估算」怎么标)
- `src/data/shells.ts` 的弹种规则;`docs/physics-validation.md` 第 1、8 节的出处格式
- Readme.md「核心数据结构约定」一节

## 要调研的内容

- **防护:** 车体 / 炮塔的正面、侧面、背面装甲。要写水平来弹的视线厚度,并注明实际厚度和倾角。
- **机动:** 最大速度、转向、功率 / 重量。
- **火炮:** 76 mm M1 系列火炮:俯仰范围、高低机 / 方向机速度、装填时间(注明依据)。
- **瞄准镜:** 型号和倍率。
- **弹药:** M62 APC(BC)、M79 AP、M93 HVAP、M42A1 HE。每种要:弹重、初速、穿深(注明测试条件)、装药量、引信延迟。
- **同轴机枪:** M1919A4 的射速、弹链长度、携弹量。
- **内部布局:** 乘员位置和弹药架位置(W = 湿式弹药架)的大致坐标与容量,附示意图出处。

## 允许修改的文件

- 新增:`docs/research/m4a3-76w.md`(表格:字段 / 数值 / 单位 / 出处链接或书名页码 / 备注)

## 验收标准

- [ ] 每个数值都有出处,或者明确标注「估算」并写出估算方法
- [ ] 来源互相矛盾时,把各来源都列出来,并说明建议采用哪个、为什么
- [ ] 文末附一个 `VehicleSpec` 草稿(放在 markdown 代码块里,不要建 .ts 文件)
- [ ] 没有改动 `src/`、`tests/`

## 结果(完成后填写)

- 新增文件:`docs/research/m4a3-76w.md`(资料来源、VVSS / HVSS 对比、防护、机动、火炮、瞄准镜、弹药与两套穿深表、同轴机枪、内部布局、`VehicleSpec` 草稿、待决定事项)。没有改动 `src/`、`tests/`
- 主要来源:
  - afvdatabase 的 M4A3(76)W 数据表(注明转载自 Hunnicutt《Sherman》1994;VVSS 尺寸表取自《Catalogue of Standard Ordnance Items》),下载网页原文逐字核对过
  - Wikipedia「76 mm gun M1」(引 Leventhal 1996、Hunnicutt 1978 等)和「M4 Sherman」,读的是条目源码
  - bulletpicker.com 的 M62 弹丸和 M66A1 引信页(引 TM 9-1904 等)
  - Wikipedia「M1919」
  - War Thunder 官方 wiki:按负责人决定,在公开资料查不准时使用
- 没查到或只能估算的:
  - 改用 War Thunder 值:瞄准镜倍率、装填时间、高低机速度
  - 没查到:M42A1 引信、同轴机枪在 6,250 发里的份额、.30 AP M2 弹数据、两个车底弹药箱各在哪一侧
  - 估算:转向速度、起步加速度、车体盒 / 炮塔盒尺寸、所有模块和乘员坐标、M62 引信延时
- 来源矛盾(都已在文档里列出并给了建议):
  - M93 弹重:3.45 kg,另说 4.24 kg(后者未能核实)
  - M62 装药:65 g,另说 77 g
  - 两种悬挂的重量和尺寸不同
- 没能打开的来源:
  - theshermantank.com(人机验证,没有绕过)
  - Axis History Forum、G503 论坛(403)
  - CGSC 馆藏的 HVAP 文件(没有正文)
- 负责人 2026-09-29 已决定:做 HVSS(草稿已改);查不准的值用 War Thunder wiki;其余按文档里的建议。建模时再定的 4 条见文档第 11 节
