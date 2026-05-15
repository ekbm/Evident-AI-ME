import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const workbook = XLSX.utils.book_new();

// Sheet 1: Tier Overview
const tierOverview = [
  ['Evident Pricing Tier Analysis', '', '', '', '', ''],
  ['', '', '', '', '', ''],
  ['Tier', 'Price/Month', 'Est. Cost/User', 'Gross Profit', 'Margin %', 'Notes'],
  ['Free', '$0', '$0', '$0', '-', 'Lead generation, 3 docs max'],
  ['Starter', '$5', '$0.30', '$4.70', '94%', 'Light users, 25 docs, 50 Q/mo'],
  ['Pro', '$39', '$4.00', '$35.00', '90%', 'Core tier, 1K docs, 500 Q/mo'],
  ['Plus', '$24', '$3.00', '$21.00', '88%', 'Mid tier, 2K docs'],
  ['Premium', '$99', '$17.00', '$82.00', '83%', 'Power users, 5K docs, 2K Q/mo'],
  ['Enterprise', '$299', '$50.00', '$249.00', '83%', 'Teams, 50K docs, 10K Q/mo'],
];
const ws1 = XLSX.utils.aoa_to_sheet(tierOverview);
ws1['!cols'] = [{ wch: 18 }, { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 10 }, { wch: 30 }];
XLSX.utils.book_append_sheet(workbook, ws1, 'Tier Overview');

// Sheet 2: Pro Tier ($39) Detailed Breakdown
const proTierData = [
  ['Pro Tier - $39/month', '', '', ''],
  ['', '', '', ''],
  ['Feature Limits', '', '', ''],
  ['Storage', '1 GB', '', ''],
  ['Indexed Documents', '1,000', '', ''],
  ['Knowledge Chunks', '50,000', '', ''],
  ['Questions/Month', '500', '', ''],
  ['Max File Size', '25 MB', '', ''],
  ['Audio/Video Minutes', '60 min', '', ''],
  ['', '', '', ''],
  ['API Cost Breakdown', 'Usage', 'Unit Cost', 'Monthly Cost'],
  ['Embeddings (1K docs, 50K chunks)', '~10M tokens', '$0.02/1M tokens', '$0.20'],
  ['Questions (500/month)', '~10M tokens', '$0.20/1M avg', '$2.00'],
  ['Audio/Video (60 min)', '60 minutes', '$0.006/min', '$0.36'],
  ['Vision/OCR (est. 100 pages)', '100 images', '$0.01/image', '$1.00'],
  ['', '', '', ''],
  ['Cost Summary', '', '', ''],
  ['OpenAI API Total', '', '', '$3.56'],
  ['Infrastructure Overhead', '', '', '$0.50'],
  ['Total Cost/User', '', '', '$4.06'],
  ['', '', '', ''],
  ['Margin Analysis', '', '', ''],
  ['Price', '', '', '$39.00'],
  ['Cost', '', '', '$4.06'],
  ['Gross Profit', '', '', '$34.94'],
  ['Margin', '', '', '90%'],
];
const ws2 = XLSX.utils.aoa_to_sheet(proTierData);
ws2['!cols'] = [{ wch: 35 }, { wch: 15 }, { wch: 18 }, { wch: 15 }];
XLSX.utils.book_append_sheet(workbook, ws2, 'Pro Tier ($39)');

// Sheet 3: Premium Tier ($99) Detailed Breakdown
const premiumTierData = [
  ['Premium Tier - $99/month', '', '', ''],
  ['', '', '', ''],
  ['Feature Limits', '', '', ''],
  ['Storage', '5 GB', '', ''],
  ['Indexed Documents', '5,000', '', ''],
  ['Knowledge Chunks', '250,000', '', ''],
  ['Questions/Month', '2,000', '', ''],
  ['Max File Size', '50 MB', '', ''],
  ['Audio/Video Minutes', '180 min', '', ''],
  ['', '', '', ''],
  ['API Cost Breakdown', 'Usage', 'Unit Cost', 'Monthly Cost'],
  ['Embeddings (5K docs, 250K chunks)', '~50M tokens', '$0.02/1M tokens', '$1.00'],
  ['Questions (2,000/month)', '~40M tokens', '$0.20/1M avg', '$8.00'],
  ['Audio/Video (180 min)', '180 minutes', '$0.006/min', '$1.08'],
  ['Vision/OCR (est. 500 pages)', '500 images', '$0.01/image', '$5.00'],
  ['', '', '', ''],
  ['Cost Summary', '', '', ''],
  ['OpenAI API Total', '', '', '$15.08'],
  ['Infrastructure Overhead', '', '', '$2.00'],
  ['Total Cost/User', '', '', '$17.08'],
  ['', '', '', ''],
  ['Margin Analysis', '', '', ''],
  ['Price', '', '', '$99.00'],
  ['Cost', '', '', '$17.08'],
  ['Gross Profit', '', '', '$81.92'],
  ['Margin', '', '', '83%'],
];
const ws3 = XLSX.utils.aoa_to_sheet(premiumTierData);
ws3['!cols'] = [{ wch: 35 }, { wch: 15 }, { wch: 18 }, { wch: 15 }];
XLSX.utils.book_append_sheet(workbook, ws3, 'Premium Tier ($99)');

// Sheet 4: OpenAI API Pricing Reference
const apiPricingData = [
  ['OpenAI API Pricing Reference', '', ''],
  ['', '', ''],
  ['Model/Service', 'Input Cost', 'Output Cost'],
  ['text-embedding-3-small', '$0.02/1M tokens', 'N/A'],
  ['gpt-4.1-mini (input)', '$0.15/1M tokens', ''],
  ['gpt-4.1-mini (output)', '', '$0.60/1M tokens'],
  ['Whisper (transcription)', '$0.006/minute', 'N/A'],
  ['Vision/Image analysis', '~$0.01/image', 'Varies by size'],
  ['', '', ''],
  ['Typical Token Estimates', '', ''],
  ['1 page of text', '~500 tokens', ''],
  ['1 Q&A exchange', '~2,000 tokens in', '~500 tokens out'],
  ['1 document chunk', '~200 tokens', ''],
  ['', '', ''],
  ['Cost Optimization Tips', '', ''],
  ['1. Use RAG to send only relevant chunks', '', ''],
  ['2. Cache frequent queries', '', ''],
  ['3. Batch embeddings when possible', '', ''],
  ['4. Use smaller models for simple tasks', '', ''],
];
const ws4 = XLSX.utils.aoa_to_sheet(apiPricingData);
ws4['!cols'] = [{ wch: 40 }, { wch: 20 }, { wch: 20 }];
XLSX.utils.book_append_sheet(workbook, ws4, 'API Pricing Reference');

// Sheet 5: Break-Even Calculator
const breakEvenData = [
  ['Break-Even Calculator', '', '', ''],
  ['', '', '', ''],
  ['Input Variables', 'Value', '', ''],
  ['Monthly Price', '$39', '', ''],
  ['Stripe Fee (2.9% + $0.30)', '$1.43', '', ''],
  ['Net Revenue After Stripe', '$37.57', '', ''],
  ['', '', '', ''],
  ['Cost Variables', 'Per User', '', ''],
  ['OpenAI API (typical usage)', '$3.50', '', ''],
  ['Infrastructure', '$0.50', '', ''],
  ['Total Variable Cost', '$4.00', '', ''],
  ['', '', '', ''],
  ['Fixed Costs (Monthly)', 'Amount', '', ''],
  ['Replit Hosting', '$25', '', ''],
  ['Domain/SSL', '$1', '', ''],
  ['Total Fixed Costs', '$26', '', ''],
  ['', '', '', ''],
  ['Break-Even Analysis', '', '', ''],
  ['Contribution Margin/User', '$33.57', '(Net Revenue - Variable Cost)', ''],
  ['Users to Cover Fixed Costs', '1', '($26 / $33.57)', ''],
  ['Break-Even Users', '1', '', ''],
  ['', '', '', ''],
  ['Profitability at Scale', '10 Users', '50 Users', '100 Users'],
  ['Revenue', '$390', '$1,950', '$3,900'],
  ['Variable Costs', '$40', '$200', '$400'],
  ['Fixed Costs', '$26', '$26', '$26'],
  ['Net Profit', '$324', '$1,724', '$3,474'],
  ['Profit Margin', '83%', '88%', '89%'],
];
const ws5 = XLSX.utils.aoa_to_sheet(breakEvenData);
ws5['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 25 }, { wch: 15 }];
XLSX.utils.book_append_sheet(workbook, ws5, 'Break-Even Calculator');

// Write to file
const outputPath = path.join(process.cwd(), 'evident-pricing-analysis.xlsx');
XLSX.writeFile(workbook, outputPath);
console.log(`Excel file created: ${outputPath}`);
