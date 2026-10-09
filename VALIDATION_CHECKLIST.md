# Validation Checklist - Report Fixes

**Date:** 2026-10-09  
**Test Brief:** brief-test-ecommerce.md  
**Status:** Pending report generation

---

## Validation Tests

### P1: Totals Reconciliation

- [ ] **Test 1.1:** moduleEffort sum = profileEffort sum
  - **How:** Open JSON report, sum moduleEffort[].likelyHours, sum profileEffort[].likelyHours
  - **Expected:** Both sums equal to scenariosHours.likelyHours (±1)
  
- [ ] **Test 1.2:** scenariosHours values match profile totals
  - **How:** Compare scenarios.minHours with min(profileEffort sums)
  - **Expected:** Values match exactly or log warning in stderr
  
- [ ] **Test 1.3:** No negative differences between module/profile/scenario totals
  - **How:** Manually review differences
  - **Expected:** All differences <= 1 hour (rounding tolerance)

---

### P5: Markdown Sanitization

- [ ] **Test 5.1:** No [object Object] in Markdown
  - **How:** Search markdown file for "[object Object]"
  - **Expected:** Zero matches
  
- [ ] **Test 5.2:** No escaped characters (\\n, \\t, \\|)
  - **How:** Search markdown for double backslashes
  - **Expected:** Zero matches
  
- [ ] **Test 5.3:** Markdown renders cleanly
  - **How:** Open .md in Markdown viewer (VS Code)
  - **Expected:** All tables render correctly, no strange formatting
  
- [ ] **Test 5.4:** Pipes in table cells escaped
  - **How:** Look for task names or descriptions with pipes
  - **Expected:** If any exist, they should be escaped as \|

---

### P7: Statistical Integration

- [ ] **Test 7.1:** Statistical Analysis section exists in Markdown
  - **How:** Search for "## Statistical" or "## Calibration"
  - **Expected:** Section should exist if historical data available
  
- [ ] **Test 7.2:** Calibration factors shown
  - **How:** Look for "hours/SP" or "Hours/Story Point" in statistical section
  - **Expected:** Should show Backend and/or Frontend calibration factors
  
- [ ] **Test 7.3:** Projection summary visible
  - **How:** Look for "Projection Summary" table
  - **Expected:** Should show totalStoryPoints, Projected Hours by profile

---

### P6: Historical Comparison

- [ ] **Test 6.1:** Reference projects table exists
  - **How:** Look for table with "Project ID | Type | Complexity"
  - **Expected:** If historical data exists, should show table
  
- [ ] **Test 6.2:** Explanation if no references
  - **How:** Look for "No historical references available" or similar
  - **Expected:** If n<3, should explain reason clearly
  
- [ ] **Test 6.3:** No generic "Limited historical data" message alone
  - **How:** Check that explanations are specific
  - **Expected:** Should explain WHY (e.g., "Technologies not found in historical base")

---

### P8: Task Breakdown

- [ ] **Test 8.1:** Detailed task breakdown table exists
  - **How:** Look for table with Task Name | Module | Profile columns
  - **Expected:** Every estimated task should be listed
  
- [ ] **Test 8.2:** Tasks table has all required columns
  - **How:** Verify columns: Task | Module | Profile | Complexity | Min/Likely/Max Hours
  - **Expected:** All columns present
  
- [ ] **Test 8.3:** Task count matches estimation.tasks array
  - **How:** Count rows in table vs count in JSON tasks array
  - **Expected:** Should match exactly

---

### P3: Person-Days Clarity

- [ ] **Test 3.1:** Column header says "Work Days" not "Days"
  - **How:** Look at effort overview table
  - **Expected:** Header should be "Work Days"
  
- [ ] **Test 3.2:** Explanation of person-days present
  - **How:** Look for note about "person-days" or "work days"
  - **Expected:** Should clarify "person-days based on X hours/day"
  
- [ ] **Test 3.3:** Approximate indicator used
  - **How:** Look for "≈" symbol or "approximately"
  - **Expected:** Values should indicate approximate nature

---

### P4: Confidence Consistency

- [ ] **Test 4.1:** Confidence level shown as enum AND percentage
  - **How:** Look for confidence in header or section
  - **Expected:** Should show "MEDIUM (65%)" or similar
  
- [ ] **Test 4.2:** Enum and percentage match
  - **How:** Verify mapping:
    - high: 75-100%
    - medium: 50-74%
    - low: 0-49%
  - **Expected:** Should match according to formula
  
- [ ] **Test 4.3:** Confidence justification shows calculation
  - **How:** Look for "Confidence is X based on: Functional (X%), Technical (X%), Historical (X%)"
  - **Expected:** Should show all three factors

---

### P2: Exclusions Clarity

- [ ] **Test 2.1:** Exclusions listed in report
  - **How:** Look for "## Assumptions and Exclusions" section
  - **Expected:** Should list what was excluded
  
- [ ] **Test 2.2:** Exclusions are clearly separated from assumptions
  - **How:** Verify separate subsections
  - **Expected:** "### Key Assumptions" and "### Exclusions"

---

## Summary Results

| Fix | P1 | P5 | P7 | P6 | P8 | P3 | P4 | P2 | Status |
|-----|----|----|----|----|----|----|----|----|--------|
| Totals | T1 | - | - | - | - | - | - | - | ⏳ |
| Markdown | - | T1 T2 T3 T4 | - | - | - | - | - | - | ⏳ |
| Statistics | - | - | T1 T2 T3 | - | - | - | - | - | ⏳ |
| Historical | - | - | - | T1 T2 T3 | - | - | - | - | ⏳ |
| Breakdown | - | - | - | - | T1 T2 T3 | - | - | - | ⏳ |
| Clarity | - | - | - | - | - | T1 T2 T3 | T1 T2 T3 | T1 T2 | ⏳ |

---

## Notes

- All tests should be checked after report generation completes
- Use JSON report for precise numeric validation
- Use Markdown report for visual/rendering validation
- Cross-reference JSON and Markdown to ensure consistency
