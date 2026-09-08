import { Global, Module } from '@nestjs/common';
import { ProviderRegistry } from './provider.registry';
import { SandboxAsr, SandboxChannel, SandboxLlm, SandboxTelephony, SandboxTts } from './sandbox.provider';

@Global()
@Module({
  providers: [SandboxLlm, SandboxAsr, SandboxTts, SandboxTelephony, SandboxChannel, ProviderRegistry],
  exports: [ProviderRegistry, SandboxTelephony],
})
export class ProviderModule {}
