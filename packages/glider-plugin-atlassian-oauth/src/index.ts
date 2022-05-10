import { PluginContext } from 'glider';

export function activate(context: PluginContext) {
  console.log('Hi!', context.bar);
}
