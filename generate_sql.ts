import fs from 'fs';
import {
  helperFunctionsSqlScript,
  reportsAndAttendanceSqlScript,
  notificationsSqlScript,
  feesSqlScript,
  feedbackSqlScript,
  nextGenFeaturesSqlScript,
  ghanaianOptimizationSqlScript,
  messagingSqlScript,
  securityCleanupSqlScript,
  rlsPoliciesSqlScript
} from './lib/db-scripts';

const allScripts = `
-- ==========================================
-- SMART SCHOOL FULL DATABASE SETUP SCRIPT
-- ==========================================

-- 1. HELPER FUNCTIONS & BASE SCHEMA
${helperFunctionsSqlScript}

-- 2. REPORTS AND ATTENDANCE
${reportsAndAttendanceSqlScript}

-- 3. NOTIFICATIONS
${notificationsSqlScript}

-- 4. FEES
${feesSqlScript}

-- 5. FEEDBACK
${feedbackSqlScript}

-- 6. NEXT GEN FEATURES (PTM, Expenses, Scholarships)
${nextGenFeaturesSqlScript}

-- 7. GHANAIAN OPTIMIZATION & MOCK ASSESSMENTS
${ghanaianOptimizationSqlScript}

-- 8. MESSAGING
${messagingSqlScript}

-- 9. SECURITY CLEANUP
${securityCleanupSqlScript}

-- 10. COMPREHENSIVE RLS POLICIES FOR ALL TABLES (Must execute after all tables are created)
${rlsPoliciesSqlScript}
`;

fs.writeFileSync('database_setup.sql', allScripts);
console.log('database_setup.sql created successfully!');
