import * as fs from 'fs';

function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  const headers = lines[0].split(',');
  
  return lines.slice(1).map(line => {
    const values = line.split(',');
    const entry = {};
    headers.forEach((header, index) => {
      entry[header.trim()] = values[index]?.trim() || '';
    });
    return entry;
  });
}

function crossCheckWithdrawals() {
  // Parse both CSV files
  const commitAmountData = parseCSV('public/commit-amount.csv');
  const eligibleGovernorsData = parseCSV('public/final-commit-amount.csv');
  
  // Create sets for fast lookup
  const eligibleAddresses = new Set(eligibleGovernorsData.map(row => row.Address));
  
  // Find addresses that withdrew (in commit-amount but not in eligible)
  const withdrawnAddresses = [];
  
  commitAmountData.forEach(row => {
    if (!eligibleAddresses.has(row.Address)) {
      withdrawnAddresses.push({
        address: row.Address,
        transactionId: row['Transaction ID'],
        totalCommittedAmount: parseInt(row['Total Committed Amount in Algo'])
      });
    }
  });
  
  // Calculate total withdrawn amount
  const totalWithdrawn = withdrawnAddresses.reduce((sum, entry) => sum + entry.totalCommittedAmount, 0);
  
  // Generate CSV output
  const csvHeaders = 'Address,Transaction ID,Total Committed Amount in Algo\n';
  const csvContent = withdrawnAddresses.map(entry => 
    `${entry.address},${entry.transactionId},${entry.totalCommittedAmount}`
  ).join('\n');
  
  const outputCsv = csvHeaders + csvContent;
  
  // Write to file
  fs.writeFileSync('public/withdrawn-addresses.csv', outputCsv);
  
  // Print summary
  console.log(`Cross-check completed:`);
  console.log(`- Total addresses in commit-amount.csv: ${commitAmountData.length}`);
  console.log(`- Total addresses in eligible governors: ${eligibleGovernorsData.length}`);
  console.log(`- Addresses that withdrew: ${withdrawnAddresses.length}`);
  console.log(`- Total amount withdrawn: ${totalWithdrawn.toLocaleString()} Algo`);
  console.log(`- Output saved to: public/withdrawn-addresses.csv`);
  
  // Show top 10 largest withdrawals
  console.log('\nTop 10 largest withdrawals:');
  withdrawnAddresses
    .sort((a, b) => b.totalCommittedAmount - a.totalCommittedAmount)
    .slice(0, 10)
    .forEach((entry, index) => {
      console.log(`${index + 1}. ${entry.address}: ${entry.totalCommittedAmount.toLocaleString()} Algo`);
    });
}

// Run the cross-check
crossCheckWithdrawals();
