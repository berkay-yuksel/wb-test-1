const fs = require("fs");

// ── 1. Metadata'yı oku ──────────────────────────────────────────────────────
const metadata = JSON.parse(fs.readFileSync("_metadata.json", "utf-8"));
const TOTAL = metadata.length;
console.log(`Toplam NFT sayısı: ${TOTAL}\n`);

// ── 2. Her trait_type → value için kaç NFT var say ──────────────────────────
const traitCounts = {};      // traitCounts[trait_type][value] = count
const traitNftCount = {};    // kaç NFT bu trait_type'a sahip

for (const nft of metadata) {
  const seenTypes = new Set();
  for (const attr of nft.attributes || []) {
    const { trait_type: t, value: v } = attr;
    if (!traitCounts[t]) traitCounts[t] = {};
    traitCounts[t][v] = (traitCounts[t][v] || 0) + 1;
    seenTypes.add(t);
  }
  for (const t of seenTypes) {
    traitNftCount[t] = (traitNftCount[t] || 0) + 1;
  }
}

// ── 3. Trait bazlı istatistikler ─────────────────────────────────────────────
const traitStats = {};

for (const [traitType, values] of Object.entries(traitCounts)) {
  const base = traitNftCount[traitType];
  traitStats[traitType] = {};
  for (const [value, count] of Object.entries(values)) {
    const percentage = (count / base) * 100;
    const rarityScore = 1 / (count / TOTAL);
    traitStats[traitType][value] = {
      count,
      percentage: Math.round(percentage * 100) / 100,
      rarity_score: Math.round(rarityScore * 10000) / 10000,
    };
  }
}

// ── 4. Genel rarity: her NFT için toplam rarity score ───────────────────────
const nftRarity = metadata.map((nft) => {
  let totalScore = 0;
  const traits = (nft.attributes || []).map((attr) => {
    const { trait_type: t, value: v } = attr;
    const s = traitStats[t][v];
    totalScore += s.rarity_score;
    return {
      trait_type: t,
      value: v,
      count: s.count,
      percentage: s.percentage,
      rarity_score: s.rarity_score,
    };
  });
  return {
    edition: nft.edition,
    name: nft.name,
    total_rarity_score: Math.round(totalScore * 10000) / 10000,
    traits,
  };
});

// Rank sıralaması
nftRarity.sort((a, b) => b.total_rarity_score - a.total_rarity_score);
nftRarity.forEach((item, i) => (item.rank = i + 1));

const rarityByEdition = Object.fromEntries(
  nftRarity.map((item) => [item.edition, item])
);

// ── 5. _metadata_rarity.json oluştur ────────────────────────────────────────
const metadataRarity = metadata.map((nft) => {
  const nftCopy = JSON.parse(JSON.stringify(nft)); // deep copy
  const rarity = rarityByEdition[nft.edition];

  nftCopy.attributes = nftCopy.attributes.map((attr) => {
    const s = traitStats[attr.trait_type][attr.value];
    return {
      ...attr,
      rarity_score: s.rarity_score,
      count: s.count,
      percentage: s.percentage,
    };
  });

  nftCopy.rarity = {
    total_rarity_score: rarity.total_rarity_score,
    rank: rarity.rank,
    total_supply: TOTAL,
  };

  return nftCopy;
});

fs.writeFileSync(
  "_metadata_rarity.json",
  JSON.stringify(metadataRarity, null, 2),
  "utf-8"
);
console.log("✅  _metadata_rarity.json oluşturuldu.\n");

// ── 6. Konsol raporu ─────────────────────────────────────────────────────────

// --- Trait bazlı ---
console.log("=".repeat(60));
console.log("TRAIT BAZLI RARITY");
console.log("=".repeat(60));

for (const traitType of Object.keys(traitStats).sort()) {
  console.log(`\n▶ ${traitType}`);
  const sorted = Object.entries(traitStats[traitType]).sort(
    (a, b) => b[1].rarity_score - a[1].rarity_score
  );
  for (const [value, s] of sorted) {
    const bar = "█".repeat(Math.max(1, Math.floor(s.percentage / 5)));
    console.log(
      `  ${value.padEnd(25)} ${String(s.count).padStart(3)} NFT` +
        `  %${String(s.percentage.toFixed(1)).padStart(5)}` +
        `  score:${String(s.rarity_score.toFixed(2)).padStart(9)}  ${bar}`
    );
  }
}

// --- Genel sıralama ---
const ranked = [...nftRarity].sort((a, b) => a.rank - b.rank);
const showTop = 10;

console.log("\n" + "=".repeat(60));
console.log("GENEL RARITY SIRALAMASI (En Nadir → En Yaygın)");
console.log("=".repeat(60));

const printRow = (item) =>
  console.log(
    `  Rank #${String(item.rank).padEnd(4)} ${item.name.padEnd(22)} Score: ${item.total_rarity_score.toFixed(2).padStart(8)}`
  );

console.log(`\nİlk ${showTop} (en nadir):`);
ranked.slice(0, showTop).forEach(printRow);

console.log(`\nSon ${showTop} (en yaygın):`);
ranked.slice(-showTop).forEach(printRow);

console.log("\nTam sıralama _metadata_rarity.json içinde mevcut.");
