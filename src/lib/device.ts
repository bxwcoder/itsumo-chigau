// 機種の情報と、機種別の「通知が届かないとき」の案内
import { Capacitor, registerPlugin } from '@capacitor/core';

interface ItsumoDevicePlugin {
  getInfo(): Promise<{ manufacturer: string; brand: string; model: string; sdk: number }>;
  getReminderApps(): Promise<{ apps: { packageName: string; label: string }[] }>;
  openAppSettings(options?: { packageName?: string }): Promise<void>;
}

const ItsumoDevice = registerPlugin<ItsumoDevicePlugin>('ItsumoDevice');

export interface DeviceInfo {
  maker: string;
  model: string;
}

export const getDeviceInfo = async (): Promise<DeviceInfo | null> => {
  if (!Capacitor.isNativePlatform()) return null;
  const info = await ItsumoDevice.getInfo();
  return { maker: `${info.manufacturer} ${info.brand}`.toLowerCase(), model: info.model };
};

/** カレンダーの予定を通知してくれるアプリ（このアプリ以外） */
export const getReminderApps = async () => {
  if (!Capacitor.isNativePlatform()) return [];
  const { apps } = await ItsumoDevice.getReminderApps();
  // このアプリ自身と、カレンダーのデータを保管するだけの裏方（通知は出さない）は除く
  return apps.filter((a) => a.packageName !== 'com.bxwcoder.itsumochigau' && !a.packageName.includes('providers.calendar'));
};

export const openAppSettings = (packageName?: string) =>
  Capacitor.isNativePlatform() ? ItsumoDevice.openAppSettings(packageName ? { packageName } : undefined) : Promise.resolve();

export interface MakerGuide {
  name: string;
  steps: string[];
}

const GUIDES: [RegExp, MakerGuide][] = [
  [
    /oppo|realme|oneplus/,
    {
      name: 'OPPO',
      steps: [
        '「アプリ情報」→「バッテリー使用量」で「バックグラウンドアクティビティを許可」をオン',
        '同じ画面で「自動起動を許可」をオン',
        '最近使ったアプリの一覧で、アプリのカードを下に引いて🔒をかける',
      ],
    },
  ],
  [
    /xiaomi|redmi|poco/,
    {
      name: 'Xiaomi',
      steps: [
        '「アプリ情報」→「自動起動」をオン',
        '「バッテリーセーバー」を「制限なし」にする',
        '最近使ったアプリの一覧で、アプリを長押しして🔒をかける',
        'スマホの更新後に設定が戻ることがあるので、届かなくなったら見直す',
      ],
    },
  ],
  [
    /samsung/,
    {
      name: 'Galaxy',
      steps: [
        '「アプリ情報」→「バッテリー」を「制限なし」にする',
        'スマホの「設定」→「バッテリー」→「バックグラウンドでの使用の制限」で「スリープしないアプリ」に追加',
      ],
    },
  ],
  [
    /sharp/,
    {
      name: 'AQUOS',
      steps: [
        '「長エネスイッチ」がオンだと通知が遅れることがあります。オフにするか、自動でオンになる設定を見直す',
        '「アプリ情報」→「バッテリー」を「制限なし」にする',
      ],
    },
  ],
  [
    /google/,
    {
      name: 'Pixel',
      steps: ['ふつうは設定は不要です。届かないときは「アプリ情報」→「アプリのバッテリー使用量」を「制限なし」にする'],
    },
  ],
];

const DEFAULT_GUIDE: MakerGuide = {
  name: 'Android',
  steps: ['「アプリ情報」→「バッテリー」を「制限なし」（または「最適化しない」）にする', '省電力モードを使っているときは、オフにして試す'],
};

export const guideFor = (maker: string | undefined): MakerGuide =>
  GUIDES.find(([re]) => maker && re.test(maker))?.[1] ?? DEFAULT_GUIDE;

/** アプリを閉じると通知を止めやすく、「自動起動を許可」が必要な機種 */
export const needsAutostart = (maker: string | undefined): boolean =>
  !!maker && /oppo|realme|oneplus|xiaomi|redmi|poco|vivo|huawei|honor/.test(maker);
