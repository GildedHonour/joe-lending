const DAI = new Map();

//https://snowtrace.io/address/0xd586e7f844cea2f87f50152665bcbc2c279d8d70#code
DAI.set("43114", "0xd586e7f844cea2f87f50152665bcbc2c279d8d70"); // Token: Dai Stablecoin; contract: BridgeToken
DAI.set("43113", "0x8b01e7ff72e4dcdaba6074e77a4d21db2f372893"); //fixme


const DAI_PRICE_FEED = new Map();
DAI_PRICE_FEED.set("43114", "0x51D7180edA2260cc4F6e4EebB82FEF5c3c2B8300"); //EACAggregatorProxy contract
DAI_PRICE_FEED.set("43113", "0x5498BB86BC934c8D34FDA08E81D444153d0D06aD"); //

module.exports = async function ({
  getChainId,
  getNamedAccounts,
  deployments,
}) {
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();
  const chainId = await getChainId();
  if (!DAI.has(chainId)) {
    throw Error("No DAI on this chain");
  }

  const Joetroller = await ethers.getContract("Joetroller");
  const unitroller = await ethers.getContract("Unitroller");
  const joetroller = Joetroller.attach(unitroller.address);

  const interestRateModel = await ethers.getContract("StableInterestRateModel");

  await deploy("JDaiDelegate", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    contract: "JCollateralCapErc20Delegate",
  });
  const jDaiDelegate = await ethers.getContract("JDaiDelegate");

  const deployment = await deploy("JDaiDelegator", {
    from: deployer,
    args: [
      DAI.get(chainId),
      joetroller.address,
      interestRateModel.address,
      ethers.utils.parseUnits("2", 26).toString(),
      "Banker Joe DAI",
      "jDAI",
      8,
      deployer,
      jDaiDelegate.address,
      "0x",
    ],
    log: true,
    deterministicDeployment: false,
    contract: "JCollateralCapErc20Delegator",
  });
  await deployment.receipt;
  const jDaiDelegator = await ethers.getContract("JDaiDelegator");

  console.log("Supporting jDAI market...");
  await joetroller._supportMarket(jDaiDelegator.address, 1, {
    gasLimit: 2000000,
  });

  const priceOracle = await ethers.getContract("PriceOracleProxyUSD");
  console.log("Setting price feed source for jDAI");
  await priceOracle._setAggregators(
    [jDaiDelegator.address],
    [DAI_PRICE_FEED.get(chainId)]
  );

  const collateralFactor = "0.80";
  console.log("Setting collateral factor ", collateralFactor);
  await joetroller._setCollateralFactor(
    jDaiDelegator.address,
    ethers.utils.parseEther(collateralFactor)
  );

  const reserveFactor = "0.15";
  console.log("Setting reserve factor ", reserveFactor);
  await jDaiDelegator._setReserveFactor(ethers.utils.parseEther(reserveFactor));
};

module.exports.tags = ["jDAI"];
module.exports.dependencies = [
  "Joetroller",
  "TripleSlopeRateModel",
  "PriceOracle",
];
