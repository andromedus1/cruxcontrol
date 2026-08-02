import { apiLevel3Color, apiLevel3ColorHex } from '../domain/boards/colors';
import type { ApiLevel3Color } from '../domain/boards/types';

export function ApiLevel3ColorControl({ value, onChange }: { readonly value: ApiLevel3Color; readonly onChange: (value: ApiLevel3Color) => void }) {
  const channels = { red: (value >> 5) & 7, green: (value >> 2) & 7, blue: value & 3 };
  const update = (channel: keyof typeof channels, next: number) => onChange(apiLevel3Color(((channel === 'red' ? next : channels.red) << 5) | ((channel === 'green' ? next : channels.green) << 2) | (channel === 'blue' ? next : channels.blue)));
  return <fieldset className="color-control">
    <legend>Exact board color</legend>
    {(['red', 'green', 'blue'] as const).map((channel) => <label key={channel}>{channel}<input aria-label={`${channel} channel`} type="range" min="0" max={channel === 'blue' ? 3 : 7} value={channels[channel]} onChange={(event) => update(channel, Number(event.target.value))} /><output>{channels[channel]}</output></label>)}
    <div className="color-control__result"><span style={{ background: apiLevel3ColorHex(value) }} /><code>{apiLevel3ColorHex(value).toUpperCase()} · {value} / 0x{value.toString(16).padStart(2, '0').toUpperCase()}</code></div>
  </fieldset>;
}
