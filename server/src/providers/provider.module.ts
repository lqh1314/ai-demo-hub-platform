import { Global, Module } from '@nestjs/common';
import { ProviderRegistry } from './provider.registry';
import { SandboxAsr, SandboxChannel, SandboxLlm, SandboxTelephony, SandboxTts } from './sandbox.provider';
import { RoutingLlm } from './routing.llm';

@Global()
@Module({
  providers: [SandboxLlm, SandboxAsr, SandboxTts, SandboxTelephony, SandboxChannel, RoutingLlm, ProviderRegistry],
  exports: [ProviderRegistry, RoutingLlm, SandboxTelephony],
})
export class ProviderModule {}
