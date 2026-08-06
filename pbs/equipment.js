'use strict';

/* 装備調整専用ファイル
 * maxLevel: 最大レベル / choiceWeight: 通常3択での出やすさ
 * 各装備内の数値を変更するとゲームへ反映されます。
 */
window.PUYU_EQUIPMENT_CONFIG = [
  {
    id:'peashooter', name:'豆鉄砲', icon:'🔫', maxLevel:5, choiceWeight:7,
    bulletDamage:1, baseInterval:10, intervalReductionPerLevel:1,
    interval(level){return this.baseInterval-(level-1)*this.intervalReductionPerLevel},
    description(level){return `${this.interval(level)}秒ごとに中央からダメージ${this.bulletDamage}の玉を発射`}
  },
  {
    id:'yoichiBow', name:'与一の弓', icon:'🏹', maxLevel:5, choiceWeight:7,
    powerBonus:3, baseTolerance:.05, tolerancePerLevel:.05,
    tolerance(level){return this.baseTolerance+(level-1)*this.tolerancePerLevel},
    description(level){return `垂直±${Math.round(this.tolerance(level)*100)}%で反射するとボールPOWER +${this.powerBonus}`}
  },
  {
    id:'luckyDice', name:'ラッキーサイコロ', icon:'🎲', maxLevel:5, choiceWeight:7,
    triggerChance:.20, maxBonusOffset:1,
    maxBonus(level){return level+this.maxBonusOffset},
    description(level){return `反射時${Math.round(this.triggerChance*100)}%でボールPOWER +0～${this.maxBonus(level)}`}
  },
  {
    id:'fireball', name:'ファイヤーボール', icon:'☄️', maxLevel:5, choiceWeight:7,
    triggerChance:.10, speedMultiplier:2, basePowerMultiplier:.5, powerMultiplierPerLevel:.125,
    powerMultiplier(level){return Math.min(1,this.basePowerMultiplier+(level-1)*this.powerMultiplierPerLevel)},
    description(level){return `ラケット反射時${Math.round(this.triggerChance*100)}%で😡に変化（速度×${this.speedMultiplier}・POWER×${this.powerMultiplier(level)}）`}
  },
  {
    id:'pointCard', name:'ポイントカード', icon:'💳', maxLevel:5, choiceWeight:7,
    baseMultiplier:1.1, multiplierPerLevel:.1,
    multiplier(level){return this.baseMultiplier+(level-1)*this.multiplierPerLevel},
    description(level){return `取得ポイントが${this.multiplier(level).toFixed(1)}倍`}
  }
];
