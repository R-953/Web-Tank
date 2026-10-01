/**
 * 国家国旗 / 军徽简化 SVG (约 28 × 18 px)
 * - 美国: 红白条纹 + 左上蓝底白星
 * - 苏联: 红底 + 左上角五角星 + 月牙弧镰刀(带柄)与斜向锤子(带锤头)
 * - 德国: 国防军铁十字 (Balkenkreuz), 中灰底, 白十字上叠黑色十字, 四臂等长且末端不包白边
 */

export function nationFlag(nation: string, width?: number): string {
  const w = width ?? 28;
  const h = Math.round((w * 18) / 28);

  switch (nation) {
    case 'usa': {
      // 13 道红白相间条纹 + 左上蓝底与白星
      return `<svg width="${w}" height="${h}" viewBox="0 0 28 18" xmlns="http://www.w3.org/2000/svg">
  <rect width="28" height="18" fill="#b22234" rx="1"/>
  <rect y="1.38" width="28" height="1.38" fill="#ffffff"/>
  <rect y="4.15" width="28" height="1.38" fill="#ffffff"/>
  <rect y="6.92" width="28" height="1.38" fill="#ffffff"/>
  <rect y="9.69" width="28" height="1.38" fill="#ffffff"/>
  <rect y="12.46" width="28" height="1.38" fill="#ffffff"/>
  <rect y="15.23" width="28" height="1.38" fill="#ffffff"/>
  <rect width="12" height="9.7" fill="#3c3b6e"/>
  <g fill="#ffffff" transform="scale(0.85)">
    <polygon points="3,2 3.4,3 4.5,3 3.6,3.6 3.9,4.7 3,4.1 2.1,4.7 2.4,3.6 1.5,3 2.6,3"/>
    <polygon points="7,2 7.4,3 8.5,3 7.6,3.6 7.9,4.7 7,4.1 6.1,4.7 6.4,3.6 5.5,3 6.6,3"/>
    <polygon points="11,2 11.4,3 12.5,3 11.6,3.6 11.9,4.7 11,4.1 10.1,4.7 10.4,3.6 9.5,3 10.6,3"/>
    <polygon points="5,5.5 5.4,6.5 6.5,6.5 5.6,7.1 5.9,8.2 5,7.6 4.1,8.2 4.4,7.1 3.5,6.5 4.6,6.5"/>
    <polygon points="9,5.5 9.4,6.5 10.5,6.5 9.6,7.1 9.9,8.2 9,7.6 8.1,8.2 8.4,7.1 7.5,6.5 8.6,6.5"/>
    <polygon points="3,9 3.4,10 4.5,10 3.6,10.6 3.9,11.7 3,11.1 2.1,11.7 2.4,10.6 1.5,10 2.6,10"/>
    <polygon points="7,9 7.4,10 8.5,10 7.6,10.6 7.9,11.7 7,11.1 6.1,11.7 6.4,10.6 5.5,10 6.6,10"/>
    <polygon points="11,9 11.4,10 12.5,10 11.6,10.6 11.9,11.7 11,11.1 10.1,11.7 10.4,10.6 9.5,10 10.6,10"/>
  </g>
</svg>`;
    }

    case 'ussr': {
      // 红底 + 左上角五角星 + 270°月牙弧镰刀(带柄)与斜向锤子(带方块锤头)
      return `<svg width="${w}" height="${h}" viewBox="0 0 28 18" xmlns="http://www.w3.org/2000/svg">
  <rect width="28" height="18" fill="#cc1111" rx="1"/>
  <polygon points="6,1.2 6.4,2.2 7.5,2.2 6.6,2.8 6.9,3.9 6,3.3 5.1,3.9 5.4,2.8 4.5,2.2 5.6,2.2" fill="#ffcc00"/>
  <line x1="8.5" y1="11.5" x2="4.0" y2="5.5" stroke="#ffcc00" stroke-width="0.9" stroke-linecap="round"/>
  <line x1="2.7" y1="6.5" x2="5.3" y2="4.5" stroke="#ffcc00" stroke-width="1.6" stroke-linecap="square"/>
  <path d="M 6.5 5.5 A 2.8 2.8 0 1 1 3.8 9.5" fill="none" stroke="#ffcc00" stroke-width="1.0" stroke-linecap="round"/>
  <line x1="3.8" y1="9.5" x2="2.7" y2="11.2" stroke="#ffcc00" stroke-width="1.1" stroke-linecap="round"/>
</svg>`;
    }

    case 'germany': {
      // 国防军铁十字 (Balkenkreuz), 中灰底, 白十字上叠黑色十字, 四臂等长且末端不包白边
      return `<svg width="${w}" height="${h}" viewBox="0 0 28 18" xmlns="http://www.w3.org/2000/svg">
  <rect width="28" height="18" fill="#6b6f6a" rx="1"/>
  <rect x="7" y="4.5" width="14" height="9" fill="#ffffff"/>
  <rect x="9.5" y="2" width="9" height="14" fill="#ffffff"/>
  <rect x="7" y="7.5" width="14" height="3" fill="#1b1d20"/>
  <rect x="12.5" y="2" width="3" height="14" fill="#1b1d20"/>
</svg>`;
    }

    default:
      return '';
  }
}
