const path = require('path')
require('dotenv').config({
  path: path.join(__dirname, '..', '.env')
})
const { isAddress, toBN } = require('web3').utils
const envalid = require('envalid')
const { ZERO_ADDRESS, EVM_TYPES } = require('./constants')

// Validations and constants
const evmVersions = [EVM_TYPES.BYZANTIUM, EVM_TYPES.SPURIOUSDRAGON]
const validBridgeModes = ['NATIVE_TO_ERC', 'ERC_TO_ERC', 'ERC_TO_NATIVE']
const validRewardModes = ['false', 'ONE_DIRECTION', 'BOTH_DIRECTIONS']
const validFeeManagerTypes = ['BRIDGE_VALIDATORS_REWARD', 'POSDAO_REWARD']
const bigNumValidator = envalid.makeValidator(x => toBN(x))
const validateAddress = address => {
  if (isAddress(address)) {
    return address
  }

  throw new Error(`Invalid address: ${address}`)
}
const addressValidator = envalid.makeValidator(validateAddress)
const addressesValidator = envalid.makeValidator(addresses => {
  addresses.split(' ').forEach(validateAddress)
  return addresses
})
const validateRewardableAddresses = (validators, rewards) => {
  const validatorsLength = validators ? validators.split(' ').length : 0
  const validatorsRewardLength = rewards ? rewards.split(' ').length : 0
  if (validatorsLength !== validatorsRewardLength) {
    throw new Error(
      `List of rewards accounts (${validatorsRewardLength} accounts) should be the same length as list of validators (${validatorsLength} accounts)`
    )
  }
}

const {
  BRIDGE_MODE,
  HOME_REWARDABLE,
  FOREIGN_REWARDABLE,
  VALIDATORS,
  VALIDATORS_REWARD_ACCOUNTS,
  DEPLOY_REWARDABLE_TOKEN,
  HOME_FEE_MANAGER_TYPE,
  ERC20_EXTENDED_BY_ERC677,
  HOME_EVM_VERSION,
  FOREIGN_EVM_VERSION
} = process.env

if (HOME_EVM_VERSION) {
  if (!evmVersions.includes(HOME_EVM_VERSION)) {
    throw new Error(
      `Invalid Home EVM Version: ${HOME_EVM_VERSION}. Supported values are ${evmVersions}`
    )
  }
}

if (FOREIGN_EVM_VERSION) {
  if (!evmVersions.includes(FOREIGN_EVM_VERSION)) {
    throw new Error(
      `Invalid Foreign EVM Version: ${FOREIGN_EVM_VERSION}. Supported values are ${evmVersions}`
    )
  }
}

if (!validBridgeModes.includes(BRIDGE_MODE)) {
  throw new Error(`Invalid bridge mode: ${BRIDGE_MODE}`)
}

if (!validRewardModes.includes(HOME_REWARDABLE)) {
  throw new Error(
    `Invalid HOME_REWARDABLE: ${HOME_REWARDABLE}. Supported values are ${validRewardModes}`
  )
}

if (!validRewardModes.includes(FOREIGN_REWARDABLE)) {
  throw new Error(
    `Invalid FOREIGN_REWARDABLE: ${FOREIGN_REWARDABLE}. Supported values are ${validRewardModes}`
  )
}

let validations = {
  DEPLOYMENT_ACCOUNT_PRIVATE_KEY: envalid.str(),
  DEPLOYMENT_GAS_LIMIT_EXTRA: envalid.num(),
  HOME_DEPLOYMENT_GAS_PRICE: bigNumValidator(),
  FOREIGN_DEPLOYMENT_GAS_PRICE: bigNumValidator(),
  GET_RECEIPT_INTERVAL_IN_MILLISECONDS: bigNumValidator(),
  HOME_RPC_URL: envalid.str(),
  HOME_BRIDGE_OWNER: addressValidator(),
  HOME_VALIDATORS_OWNER: addressesValidator(),
  HOME_UPGRADEABLE_ADMIN: addressValidator(),
  HOME_DAILY_LIMIT: bigNumValidator(),
  HOME_MAX_AMOUNT_PER_TX: bigNumValidator(),
  HOME_MIN_AMOUNT_PER_TX: bigNumValidator(),
  HOME_REQUIRED_BLOCK_CONFIRMATIONS: envalid.num(),
  HOME_GAS_PRICE: bigNumValidator(),
  FOREIGN_RPC_URL: envalid.str(),
  FOREIGN_BRIDGE_OWNER: addressValidator(),
  FOREIGN_VALIDATORS_OWNER: addressValidator(),
  FOREIGN_UPGRADEABLE_ADMIN: addressValidator(),
  FOREIGN_REQUIRED_BLOCK_CONFIRMATIONS: envalid.num(),
  FOREIGN_GAS_PRICE: bigNumValidator(),
  FOREIGN_MAX_AMOUNT_PER_TX: bigNumValidator(),
  REQUIRED_NUMBER_OF_VALIDATORS: envalid.num(),
  VALIDATORS: addressesValidator()
}

if (BRIDGE_MODE === 'NATIVE_TO_ERC') {
  validations = {
    ...validations,
    BRIDGEABLE_TOKEN_NAME: envalid.str(),
    BRIDGEABLE_TOKEN_SYMBOL: envalid.str(),
    BRIDGEABLE_TOKEN_DECIMALS: envalid.num(),
    FOREIGN_DAILY_LIMIT: bigNumValidator(),
    FOREIGN_MIN_AMOUNT_PER_TX: bigNumValidator(),
    DEPLOY_REWARDABLE_TOKEN: envalid.bool(),
    BLOCK_REWARD_ADDRESS: addressValidator()
  }

  if (DEPLOY_REWARDABLE_TOKEN === 'true') {
    validations = {
      ...validations,
      DPOS_STAKING_ADDRESS: addressValidator()
    }
  }

  if (FOREIGN_REWARDABLE === 'BOTH_DIRECTIONS') {
    throw new Error(
      `FOREIGN_REWARDABLE: ${FOREIGN_REWARDABLE} is not supported on ${BRIDGE_MODE} bridge mode`
    )
  }

  if (HOME_REWARDABLE === 'BOTH_DIRECTIONS' && FOREIGN_REWARDABLE === 'ONE_DIRECTION') {
    throw new Error(
      `Combination of HOME_REWARDABLE: ${HOME_REWARDABLE} and FOREIGN_REWARDABLE: ${FOREIGN_REWARDABLE} should be avoided on ${BRIDGE_MODE} bridge mode.`
    )
  }
}
if (BRIDGE_MODE === 'ERC_TO_ERC') {
  validations = {
    ...validations,
    ERC20_TOKEN_ADDRESS: addressValidator(),
    BRIDGEABLE_TOKEN_NAME: envalid.str(),
    BRIDGEABLE_TOKEN_SYMBOL: envalid.str(),
    BRIDGEABLE_TOKEN_DECIMALS: envalid.num(),
    DEPLOY_REWARDABLE_TOKEN: envalid.bool(),
    DPOS_STAKING_ADDRESS: addressValidator(),
    BLOCK_REWARD_ADDRESS: addressValidator(),
    ERC20_EXTENDED_BY_ERC677: envalid.bool()
  }

  if (ERC20_EXTENDED_BY_ERC677 === 'true') {
    validations = {
      ...validations,
      FOREIGN_DAILY_LIMIT: bigNumValidator(),
      FOREIGN_MIN_AMOUNT_PER_TX: bigNumValidator()
    }
  }

  if (FOREIGN_REWARDABLE !== 'false') {
    throw new Error(
      `Collecting fees on Foreign Network on ${BRIDGE_MODE} bridge mode is not supported.`
    )
  }
}
if (BRIDGE_MODE === 'ERC_TO_NATIVE') {
  validations = {
    ...validations,
    ERC20_TOKEN_ADDRESS: addressValidator(),
    BLOCK_REWARD_ADDRESS: addressValidator({
      default: ZERO_ADDRESS
    })
  }

  if (HOME_REWARDABLE === 'ONE_DIRECTION') {
    throw new Error(
      `Only BOTH_DIRECTIONS is supported for collecting fees on Home Network on ${BRIDGE_MODE} bridge mode.`
    )
  }

  if (FOREIGN_REWARDABLE !== 'false') {
    throw new Error(
      `Collecting fees on Foreign Network on ${BRIDGE_MODE} bridge mode is not supported.`
    )
  }

  if (HOME_REWARDABLE === 'BOTH_DIRECTIONS') {
    if (!validFeeManagerTypes.includes(HOME_FEE_MANAGER_TYPE)) {
      throw new Error(
        `Invalid fee manager type: HOME_FEE_MANAGER_TYPE = ${HOME_FEE_MANAGER_TYPE}. Supported values are ${validFeeManagerTypes}`
      )
    }
  }
}

if (HOME_REWARDABLE !== 'false' || FOREIGN_REWARDABLE !== 'false') {
  validateRewardableAddresses(VALIDATORS, VALIDATORS_REWARD_ACCOUNTS)
  validations = {
    ...validations,
    VALIDATORS_REWARD_ACCOUNTS: addressesValidator(),
    HOME_TRANSACTIONS_FEE: envalid.num(),
    FOREIGN_TRANSACTIONS_FEE: envalid.num()
  }
}

const env = envalid.cleanEnv(process.env, validations)

if (
  env.BRIDGE_MODE === 'ERC_TO_ERC' &&
  env.HOME_REWARDABLE === 'true' &&
  env.BLOCK_REWARD_ADDRESS === ZERO_ADDRESS
) {
  throw new Error(
    'Collecting fees on Home Network on ERC_TO_ERC mode without Block Reward contract is not supported.'
  )
}

module.exports = env
