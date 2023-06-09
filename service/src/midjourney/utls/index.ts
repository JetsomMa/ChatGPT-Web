import { Epoch, Snowyflake } from 'snowyflake'

export async function sleep(ms: number): Promise<void> {
  return await new Promise(resolve => setTimeout(resolve, ms))
}

export function random(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min) + min)
}

// const snowflake = new Snowflake(1);
const snowflake = new Snowyflake({
  workerId: BigInt(1),
  epoch: Epoch.Twitter, // BigInt timestamp
})

export const nextNonce = (): string => snowflake.nextId().toString()
