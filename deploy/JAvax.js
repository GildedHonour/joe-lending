const { AvalancheFujiInfo } = require("../avalancheFujiDeployInfo.js");

const WAVAX = new Map();
WAVAX.set("4", "0xc778417e063141139fce010982780140aa0cd5ab"); // Wrapped Ether (WETH) - WETH
WAVAX.set("43114", "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7"); // Wrapped AVAX (WAVAX); contract: WAVAX


// WAVAX.set("43113", "0xd00ae08403B9bbb9124bB305C09058E32C39A48c"); // Wrapped AVAX (WAVAX)
WAVAX.set(AvalancheFujiInfo.chainId, AvalancheFujiInfo.contracts.WAVAX); // Wrapped AVAX (WAVAX)


const AVAX_PRICE_FEED = new Map();
AVAX_PRICE_FEED.set("4", "0x8A753747A1Fa494EC906cE90E9f37563A8AF630e"); // WETH
AVAX_PRICE_FEED.set("43114", "0x0A77230d17318075983913bC2145DB16C7366156"); // EACAggregatorProxy contract
AVAX_PRICE_FEED.set("43113", "0x5498BB86BC934c8D34FDA08E81D444153d0D06aD"); // EACAggregatorProxy contract


module.exports = async function ({
  getChainId,
  getNamedAccounts,
  deployments,
}) {
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();
  const chainId = await getChainId();
  const Joetroller = await ethers.getContract("Joetroller");
  const unitroller = await ethers.getContract("Unitroller");
  const joetroller = Joetroller.attach(unitroller.address);

  const interestRateModel = await ethers.getContract("MajorInterestRateModel");

  await deploy("JAvaxDelegate", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    contract: "JWrappedNativeDelegate",
  });
  const jAvaxDelegate = await ethers.getContract("JAvaxDelegate");

  const deployment = await deploy("JAvaxDelegator", {
    from: deployer,
    args: [
      WAVAX.get(chainId),
      joetroller.address,
      interestRateModel.address,
      ethers.utils.parseUnits("2", 26).toString(),
      "Banker Joe AVAX",
      "jAVAX",
      8,
      deployer,
      jAvaxDelegate.address,
      "0x",
    ],
    log: true,
    deterministicDeployment: false,
    contract: "JWrappedNativeDelegator",
  });
  await deployment.receipt;
  const jAvaxDelegator = await ethers.getContract("JAvaxDelegator");

  console.log("Supporting jAVAX market...");
  await joetroller._supportMarket(jAvaxDelegator.address, 2, {
    gasLimit: 2000000,
  });

  const priceOracle = await ethers.getContract("PriceOracleProxyUSD");
  console.log("Setting price feed source for jAVAX");
  await priceOracle._setAggregators(
    [jAvaxDelegator.address],
    [AVAX_PRICE_FEED.get(chainId)]
  );

  const collateralFactor = "0.75";
  console.log("Setting collateral factor ", collateralFactor);
  await joetroller._setCollateralFactor(
    jAvaxDelegator.address,
    ethers.utils.parseEther(collateralFactor)
  );

  const reserveFactor = "0.20";
  console.log("Setting reserve factor ", reserveFactor);
  await jAvaxDelegator._setReserveFactor(
    ethers.utils.parseEther(reserveFactor)
  );
};

module.exports.tags = ["jAVAX"];
module.exports.dependencies = [
  "Joetroller",
  "TripleSlopeRateModel",
  "PriceOracle",
];
