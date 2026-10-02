import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { TIGER_I, T34_85 } from '../src/data/vehicles';
import { DamageModel } from '../src/game/damage/DamageModel';
import { internalsSnapshot } from '../src/game/internalsSnapshot';
import { InternalsView, internalsViewRect, healthColor } from '../src/ui/InternalsView';

describe('InternalsView 车辆内构视图组件', () => {
  let parent: HTMLDivElement;

  beforeEach(() => {
    parent = document.createElement('div');
    document.body.appendChild(parent);
  });

  afterEach(() => {
    parent.remove();
  });

  it('视口计算 internalsViewRect 居中靠左 16px', () => {
    const rect = internalsViewRect(1920, 1080);
    expect(rect.x).toBe(16);
    expect(rect.w).toBe(440);
    expect(rect.h).toBe(270);
    expect(rect.y).toBe(Math.round((1080 - 270) / 2));
  });

  it('显隐状态 setVisible / visible 控制 DOM 显示', () => {
    const view = new InternalsView(parent);
    expect(view.visible).toBe(false);

    const frame = parent.querySelector('.internals-view-frame') as HTMLDivElement;
    expect(frame).not.toBeNull();
    expect(frame.style.display).toBe('none');

    view.setVisible(true);
    expect(view.visible).toBe(true);
    expect(frame.style.display).toBe('block');

    view.setVisible(false);
    expect(view.visible).toBe(false);
    expect(frame.style.display).toBe('none');

    view.dispose();
  });

  it('update 不抛错，正确渲染标题、图例与乘员岗位', () => {
    const view = new InternalsView(parent);
    const damage = new DamageModel(TIGER_I);
    const snap = internalsSnapshot({ spec: TIGER_I, turretYaw: 0.1, gunPitch: 0.05, damage });

    expect(() => view.update(snap)).not.toThrow();

    // 检查标题包含车名
    expect(parent.textContent).toContain('虎式');

    // 检查图例说明
    expect(parent.textContent).toContain('弹药架');
    expect(parent.textContent).toContain('发动机');
    expect(parent.textContent).toContain('高低机');

    // 检查乘员标签
    expect(parent.textContent).toContain('车长');
    expect(parent.textContent).toContain('炮手');
    expect(parent.textContent).toContain('驾驶员');

    view.dispose();
  });

  it('模型按 spec.id 缓存，同车型不重建，换车才重建', () => {
    const view = new InternalsView(parent);
    const damage1 = new DamageModel(TIGER_I);
    const snap1 = internalsSnapshot({ spec: TIGER_I, turretYaw: 0, gunPitch: 0, damage: damage1 });

    view.update(snap1);
    const root1 = (view as unknown as { root: THREE.Group }).root;
    expect(root1).toBeDefined();

    // 同车型不同姿态更新，不应重建 root 模型
    const snap2 = internalsSnapshot({ spec: TIGER_I, turretYaw: 0.5, gunPitch: 0.2, damage: damage1 });
    view.update(snap2);
    const root2 = (view as unknown as { root: THREE.Group }).root;
    expect(root2).toBe(root1);

    // 换为 T-34-85，触发模型重建
    const damageT34 = new DamageModel(T34_85);
    const snapT34 = internalsSnapshot({ spec: T34_85, turretYaw: 0, gunPitch: 0, damage: damageT34 });
    view.update(snapT34);

    const root3 = (view as unknown as { root: THREE.Group }).root;
    expect(root3).not.toBe(root1);
    expect(parent.textContent).toContain('T-34-85');

    view.dispose();
  });

  it('受损时模块与乘员颜色实时更新', () => {
    const view = new InternalsView(parent);
    const damage = new DamageModel(TIGER_I);
    const snap1 = internalsSnapshot({ spec: TIGER_I, turretYaw: 0, gunPitch: 0, damage });
    view.update(snap1);

    // 初始满血：颜色为绿色
    const engineModule = (view as unknown as { modulesMap: Map<string, { mat: THREE.MeshBasicMaterial }> }).modulesMap.get('engine')!;
    expect(engineModule.mat.color.getHex()).toBe(healthColor(1));

    // 发动机受损到 40%：颜色更新为橙色
    const engine = damage.modules.find((m) => m.type === 'engine')!;
    engine.hp = engine.maxHp * 0.4;
    const snap2 = internalsSnapshot({ spec: TIGER_I, turretYaw: 0, gunPitch: 0, damage });
    view.update(snap2);
    expect(engineModule.mat.color.getHex()).toBe(healthColor(0.4));

    // 乘员阵亡：颜色更新为黑/暗灰
    const gunner = damage.crew.find((c) => c.homeRole === 'gunner')!;
    gunner.hp = 0;
    gunner.alive = false;
    gunner.seat = null;
    const snap3 = internalsSnapshot({ spec: TIGER_I, turretYaw: 0, gunPitch: 0, damage });
    view.update(snap3);

    const gunnerCrew = (view as unknown as { crewMap: Map<string, { mat: THREE.MeshBasicMaterial }> }).crewMap.get(`crew:${gunner.index}`)!;
    expect(gunnerCrew.mat.color.getHex()).toBe(healthColor(0));

    view.dispose();
  });

  it('render 在无真实 WebGL(jsdom)时安全降级不抛错', () => {
    const view = new InternalsView(parent);
    view.setVisible(true);
    const damage = new DamageModel(TIGER_I);
    view.update(internalsSnapshot({ spec: TIGER_I, turretYaw: 0, gunPitch: 0, damage }));

    const mockRenderer = {
      getSize: (v: THREE.Vector2) => v.set(1920, 1080),
      setScissorTest: () => {},
      setScissor: () => {},
      setViewport: () => {},
      render: () => {},
    } as unknown as THREE.WebGLRenderer;

    expect(() => view.render(mockRenderer)).not.toThrow();

    view.dispose();
  });

  it('dispose 销毁时清理 DOM 节点', () => {
    const view = new InternalsView(parent);
    expect(parent.querySelector('.internals-view-frame')).not.toBeNull();

    view.dispose();
    expect(parent.querySelector('.internals-view-frame')).toBeNull();
  });
});
