import prisma from '../prisma';
import { protectSecret } from '../utils/security';

async function encryptStoredSecrets() {
  const stores = await prisma.wooCommerceStore.findMany();
  for (const store of stores) {
    await prisma.wooCommerceStore.update({
      where: { id: store.id },
      data: {
        consumerKey: protectSecret(store.consumerKey) || '',
        consumerSecret: protectSecret(store.consumerSecret) || '',
        webhookSecret: protectSecret(store.webhookSecret),
      },
    });
  }

  const couriers = await prisma.courierConfig.findMany();
  for (const courier of couriers) {
    await prisma.courierConfig.update({
      where: { id: courier.id },
      data: {
        apiKey: protectSecret(courier.apiKey),
        secretKey: protectSecret(courier.secretKey),
        clientSecret: protectSecret(courier.clientSecret),
        password: protectSecret(courier.password),
        accessToken: protectSecret(courier.accessToken),
        refreshToken: protectSecret(courier.refreshToken),
        webhookSecret: protectSecret(courier.webhookSecret),
        webhookVerificationSecret: protectSecret(courier.webhookVerificationSecret),
      },
    });
  }

  const gateways = await prisma.messageGatewayConfig.findMany();
  for (const gateway of gateways) {
    await prisma.messageGatewayConfig.update({
      where: { id: gateway.id },
      data: {
        apiKey: protectSecret(gateway.apiKey),
        clientSecret: protectSecret(gateway.clientSecret),
      },
    });
  }

  console.log(`Encrypted integration secrets for ${stores.length} store(s), ${couriers.length} courier(s), and ${gateways.length} gateway(s).`);
}

encryptStoredSecrets()
  .catch((error) => {
    console.error('Secret encryption migration failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
