/**
 * AliveTrust — Next Best Action Rules (v1)
 *
 * Static, versioned rule set for the NBA engine. Each rule defines:
 *   - A trigger condition (what red flag, data gap, or threshold triggers it)
 *   - An action (what the user should do)
 *   - Priority scoring weights (risk_reduction, equity_protected, time_score, dependency_unlock)
 *   - Concrete steps, evidence requirements, done definition, and escalation
 *
 * In MVP these are embedded as a constant. In future versions they may be
 * stored in a rules table and versioned per tenant or jurisdiction.
 */

export interface NBAFullRule {
  rule_id: string;
  name: string;
  description: string;
  category: 'funding' | 'documents' | 'beneficiary' | 'incapacity' | 'business' | 'evidence';
  trigger_type: 'risk' | 'gap' | 'threshold' | 'missing' | 'conflict';
  /** For 'risk': the red_flag type to check. For 'gap': the gap field pattern. For 'threshold': the metric key. */
  trigger_field: string;
  /** For 'threshold': 'lt' or 'gt'. For others: 'exists'. */
  trigger_operator: 'exists' | 'lt' | 'gt' | 'eq';
  /** For 'threshold': the numeric value. For others: ignored. */
  trigger_value: string;
  /** Priority scoring components (0-100 each) */
  risk_reduction: number;
  equity_protected: number;
  time_score: number;
  dependency_unlock: number;
  steps: string[];
  evidence_required: string[];
  done_definition: string;
  escalation_conditions: string[];
  owner_suggestion: 'self' | 'attorney' | 'financial_advisor' | 'cpa' | 'insurance_agent' | 'title_company';
  estimated_complexity: 'low' | 'medium' | 'high';
  estimated_time_minutes: number;
  enabled: boolean;
}

export const NBA_RULES_V1: NBAFullRule[] = [
  // ─── Funding Rules ──────────────────────────────────────────────────────

  {
    rule_id: 'nba-001',
    name: 'Fund Real Estate into Trust',
    description: 'One or more real estate properties are not titled in the name of the trust. These will go through probate if not transferred.',
    category: 'funding',
    trigger_type: 'risk',
    trigger_field: 'unfunded_real_estate',
    trigger_operator: 'exists',
    trigger_value: '',
    risk_reduction: 95,
    equity_protected: 90,
    time_score: 60,
    dependency_unlock: 70,
    steps: [
      'Identify which real estate assets are not yet titled in the trust name.',
      'Contact your estate attorney to prepare a grant deed (or quitclaim deed) transferring each property to the trust.',
      'Have the deed notarized and recorded with the county recorder.',
      'Obtain a certified copy of the recorded deed as evidence.',
      'Update your trust Schedule A to list the property.',
      'Confirm homeowner insurance and property tax records reflect the trust as owner.',
    ],
    evidence_required: ['Recorded grant deed', 'Updated title report or preliminary title'],
    done_definition: 'All real estate assets show funding_status = funded AND a complete property_deed document is on file for each.',
    escalation_conditions: [
      'Property has a mortgage (lender must be notified; due-on-sale clause considerations).',
      'Property is in a different state than the trust jurisdiction.',
      'Property is held in joint tenancy or community property with right of survivorship.',
    ],
    owner_suggestion: 'attorney',
    estimated_complexity: 'medium',
    estimated_time_minutes: 120,
    enabled: true,
  },

  {
    rule_id: 'nba-002',
    name: 'Record Property Deed',
    description: 'A real estate property exists but no recorded property deed is on file. Even if funded, you need proof of recording.',
    category: 'documents',
    trigger_type: 'risk',
    trigger_field: 'deed_recording_gap',
    trigger_operator: 'exists',
    trigger_value: '',
    risk_reduction: 70,
    equity_protected: 60,
    time_score: 50,
    dependency_unlock: 40,
    steps: [
      'Check with the county recorder to confirm deed recording status.',
      'If already recorded, obtain a certified copy and upload as evidence.',
      'If not recorded, have your attorney prepare and record the deed.',
      'Upload the recorded deed to your trust documents.',
    ],
    evidence_required: ['Certified copy of recorded deed', 'County recording receipt'],
    done_definition: 'A property_deed document with status = complete exists for each real estate asset.',
    escalation_conditions: [
      'County recorder has no record of the transfer.',
      'Deed was recorded but contains errors that need correction.',
    ],
    owner_suggestion: 'attorney',
    estimated_complexity: 'low',
    estimated_time_minutes: 60,
    enabled: true,
  },

  {
    rule_id: 'nba-003',
    name: 'Resolve Business Interest Transfer',
    description: 'A business interest has unknown funding status. The operating agreement may not reference the trust, leaving ownership ambiguous.',
    category: 'business',
    trigger_type: 'risk',
    trigger_field: 'business_transfer_unknown',
    trigger_operator: 'exists',
    trigger_value: '',
    risk_reduction: 80,
    equity_protected: 75,
    time_score: 40,
    dependency_unlock: 50,
    steps: [
      'Review the current operating agreement or corporate bylaws.',
      'Determine if the trust is named as the member/shareholder.',
      'If not, have your attorney draft an assignment of membership interest (LLC) or stock transfer (corporation).',
      'Execute the assignment and update the operating agreement.',
      'File any required amendments with the Secretary of State.',
      'Upload the updated operating agreement and assignment as evidence.',
    ],
    evidence_required: ['Assignment of membership interest or stock transfer', 'Updated operating agreement'],
    done_definition: 'Business asset funding_status = funded AND operating_agreement document status = complete.',
    escalation_conditions: [
      'Business has other partners/members who must consent.',
      'Operating agreement contains restrictions on trust ownership.',
      'Business is an S-Corp (trust must be a qualifying trust type).',
    ],
    owner_suggestion: 'attorney',
    estimated_complexity: 'high',
    estimated_time_minutes: 240,
    enabled: true,
  },

  // ─── Beneficiary Rules ─────────────────────────────────────────────────

  {
    rule_id: 'nba-004',
    name: 'Fix Beneficiary Mismatch',
    description: 'The current beneficiary designation on an asset does not match the intended beneficiary. This can cause assets to go to unintended recipients.',
    category: 'beneficiary',
    trigger_type: 'conflict',
    trigger_field: 'beneficiary_mismatch',
    trigger_operator: 'exists',
    trigger_value: '',
    risk_reduction: 85,
    equity_protected: 80,
    time_score: 70,
    dependency_unlock: 30,
    steps: [
      'Identify which assets have mismatched beneficiary designations.',
      'Contact each institution to obtain a new beneficiary designation form.',
      'Complete the form naming the correct beneficiary (individual or trust, per your estate plan).',
      'Submit the form to the institution and obtain written confirmation.',
      'Upload the confirmation as evidence.',
    ],
    evidence_required: ['New beneficiary designation form (signed)', 'Institution confirmation letter'],
    done_definition: 'Asset beneficiary_designation matches intended_beneficiary for all flagged assets.',
    escalation_conditions: [
      'Institution requires notarized form.',
      'Beneficiary is a minor (may need UTMA/trust provisions).',
      'Asset is a retirement account (tax implications of naming a trust vs individual).',
    ],
    owner_suggestion: 'self',
    estimated_complexity: 'low',
    estimated_time_minutes: 45,
    enabled: true,
  },

  // ─── Document Rules ────────────────────────────────────────────────────

  {
    rule_id: 'nba-005',
    name: 'Obtain Financial Power of Attorney',
    description: 'No complete Financial Power of Attorney is on file. Without one, a court conservatorship may be needed during incapacity.',
    category: 'incapacity',
    trigger_type: 'risk',
    trigger_field: 'missing_poa',
    trigger_operator: 'exists',
    trigger_value: '',
    risk_reduction: 90,
    equity_protected: 50,
    time_score: 80,
    dependency_unlock: 60,
    steps: [
      'Consult with your estate attorney about creating a durable Financial Power of Attorney.',
      'Decide whether it should be immediate or springing (effective only upon incapacity).',
      'Name a trusted agent and at least one successor agent.',
      'Have the document drafted, signed, and notarized per state requirements.',
      'Provide certified copies to financial institutions that hold your assets.',
      'Upload the signed POA as a document and the notarization proof as evidence.',
    ],
    evidence_required: ['Signed Financial Power of Attorney', 'Notarization certificate'],
    done_definition: 'A financial_poa document with status = complete is on file.',
    escalation_conditions: [
      'Grantor has diminished capacity (POA may no longer be executable; conservatorship may be needed).',
      'Multiple agents named with conflicting authority.',
    ],
    owner_suggestion: 'attorney',
    estimated_complexity: 'medium',
    estimated_time_minutes: 90,
    enabled: true,
  },

  {
    rule_id: 'nba-006',
    name: 'Obtain Healthcare Directive',
    description: 'No complete Healthcare Directive (Advance Directive) is on file. Medical decisions may default to statutory priority during incapacity.',
    category: 'incapacity',
    trigger_type: 'risk',
    trigger_field: 'missing_healthcare_directive',
    trigger_operator: 'exists',
    trigger_value: '',
    risk_reduction: 70,
    equity_protected: 20,
    time_score: 80,
    dependency_unlock: 30,
    steps: [
      'Decide on your healthcare preferences (life support, organ donation, pain management).',
      'Name a healthcare agent and at least one alternate.',
      'Have your attorney draft an Advance Healthcare Directive compliant with your state.',
      'Sign and have it witnessed (and notarized, if required by your state).',
      'Provide copies to your healthcare agent, primary care physician, and hospital.',
      'Upload the signed directive as a document.',
    ],
    evidence_required: ['Signed Healthcare Directive', 'Witness/notarization page'],
    done_definition: 'A healthcare_directive document with status = complete is on file.',
    escalation_conditions: [
      'Grantor has diminished capacity.',
      'State requires specific witness qualifications.',
    ],
    owner_suggestion: 'attorney',
    estimated_complexity: 'medium',
    estimated_time_minutes: 60,
    enabled: true,
  },

  {
    rule_id: 'nba-007',
    name: 'Name Successor Trustee',
    description: 'No successor trustee is named in the trust. If the current trustee becomes incapacitated or dies, court intervention may be required.',
    category: 'incapacity',
    trigger_type: 'risk',
    trigger_field: 'missing_successor_trustee',
    trigger_operator: 'exists',
    trigger_value: '',
    risk_reduction: 85,
    equity_protected: 40,
    time_score: 70,
    dependency_unlock: 80,
    steps: [
      'Identify one or more trusted individuals or a corporate trustee to serve as successor.',
      'Discuss responsibilities and expectations with the chosen successor(s).',
      'Have your attorney draft a trust amendment naming the successor trustee(s).',
      'Execute the amendment per trust terms (signature, notarization).',
      'Provide the successor with a Certificate of Trust and relevant account access information.',
      'Upload the amendment as a document.',
    ],
    evidence_required: ['Signed trust amendment', 'Updated Certificate of Trust'],
    done_definition: 'Trust profile successor_trustee_names is not empty AND an amendment document is on file.',
    escalation_conditions: [
      'Trust is irrevocable (may require court petition to modify trustee provisions).',
      'No suitable individual; corporate trustee may be needed.',
    ],
    owner_suggestion: 'attorney',
    estimated_complexity: 'medium',
    estimated_time_minutes: 90,
    enabled: true,
  },

  {
    rule_id: 'nba-008',
    name: 'Create Pour-Over Will',
    description: 'No Pour-Over Will is on file. Any assets that are not in the trust at death may pass through intestate succession.',
    category: 'documents',
    trigger_type: 'risk',
    trigger_field: 'no_pour_over_will',
    trigger_operator: 'exists',
    trigger_value: '',
    risk_reduction: 60,
    equity_protected: 50,
    time_score: 50,
    dependency_unlock: 20,
    steps: [
      'Consult with your estate attorney about drafting a Pour-Over Will.',
      'The will should name the trust as the sole beneficiary for any probate assets.',
      'Name a personal representative/executor.',
      'Have the will signed with witnesses per state requirements.',
      'Store the original in a safe location and upload a copy as a document.',
    ],
    evidence_required: ['Signed Pour-Over Will', 'Witness attestation page'],
    done_definition: 'A pour_over_will document with status = complete is on file.',
    escalation_conditions: [
      'Grantor has a prior will that may conflict.',
      'Assets in multiple states may require ancillary probate regardless.',
    ],
    owner_suggestion: 'attorney',
    estimated_complexity: 'medium',
    estimated_time_minutes: 90,
    enabled: true,
  },

  {
    rule_id: 'nba-009',
    name: 'Update Outdated Documents',
    description: 'One or more documents are marked as outdated. They may no longer reflect current trust terms, beneficiary wishes, or legal requirements.',
    category: 'documents',
    trigger_type: 'risk',
    trigger_field: 'outdated_documents',
    trigger_operator: 'exists',
    trigger_value: '',
    risk_reduction: 50,
    equity_protected: 30,
    time_score: 40,
    dependency_unlock: 35,
    steps: [
      'Identify which documents are outdated.',
      'For each, determine if an update, replacement, or re-execution is needed.',
      'Coordinate with your attorney for documents requiring legal drafting.',
      'Execute updated documents per applicable requirements.',
      'Upload the new documents and mark the old versions as superseded.',
    ],
    evidence_required: ['Updated document (signed)', 'Confirmation that old version is superseded'],
    done_definition: 'No documents remain with status = outdated.',
    escalation_conditions: [
      'Outdated document is the trust agreement itself (full restatement may be needed).',
      'Third parties (banks, title companies) are relying on the outdated version.',
    ],
    owner_suggestion: 'attorney',
    estimated_complexity: 'medium',
    estimated_time_minutes: 120,
    enabled: true,
  },

  // ─── Threshold Rules ───────────────────────────────────────────────────

  {
    rule_id: 'nba-010',
    name: 'Improve Funding Coverage',
    description: 'Funding coverage by value is below 80%. A significant portion of your estate may be exposed to probate.',
    category: 'funding',
    trigger_type: 'threshold',
    trigger_field: 'funding_coverage_value_pct',
    trigger_operator: 'lt',
    trigger_value: '80',
    risk_reduction: 75,
    equity_protected: 85,
    time_score: 50,
    dependency_unlock: 40,
    steps: [
      'Review the list of unfunded and partially funded assets.',
      'Prioritize assets by value (largest exposure first).',
      'For each asset type, determine the correct funding method (deed, retitling, beneficiary change).',
      'Work through the list, funding one asset at a time.',
      'Upload evidence of each funding action as you go.',
    ],
    evidence_required: ['Funding confirmation for each asset (deed, title change letter, beneficiary form)'],
    done_definition: 'funding_coverage_value_pct >= 80%.',
    escalation_conditions: [
      'Estate exceeds state probate threshold (e.g., $184,500 in California).',
      'Assets are in multiple states.',
    ],
    owner_suggestion: 'self',
    estimated_complexity: 'high',
    estimated_time_minutes: 300,
    enabled: true,
  },

  {
    rule_id: 'nba-011',
    name: 'Improve Evidence Coverage',
    description: 'Evidence completeness is below 50%. Many assets and documents lack supporting proof, making verification difficult.',
    category: 'evidence',
    trigger_type: 'threshold',
    trigger_field: 'evidence_completeness_pct',
    trigger_operator: 'lt',
    trigger_value: '50',
    risk_reduction: 30,
    equity_protected: 20,
    time_score: 30,
    dependency_unlock: 25,
    steps: [
      'Review which assets and documents are missing evidence.',
      'For funded assets: obtain account statements, title confirmations, or deed recordings.',
      'For documents: scan signed originals or obtain certified copies.',
      'Upload each piece of evidence and link it to the correct asset or document.',
    ],
    evidence_required: ['Varies per asset/document type'],
    done_definition: 'evidence_completeness_pct >= 50%.',
    escalation_conditions: [
      'Original documents are lost (attorney may need to draft replacements).',
      'Institution no longer has records on file.',
    ],
    owner_suggestion: 'self',
    estimated_complexity: 'medium',
    estimated_time_minutes: 180,
    enabled: true,
  },

  // ─── Data Gap Rules ────────────────────────────────────────────────────

  {
    rule_id: 'nba-012',
    name: 'Fill in Missing Asset Values',
    description: 'One or more assets are missing estimated values. Accurate values are needed to calculate probate exposure and funding coverage.',
    category: 'funding',
    trigger_type: 'gap',
    trigger_field: 'estimated_value',
    trigger_operator: 'exists',
    trigger_value: '',
    risk_reduction: 20,
    equity_protected: 30,
    time_score: 80,
    dependency_unlock: 50,
    steps: [
      'For each asset missing a value, determine the current market value or balance.',
      'For real estate: use a recent appraisal, Zillow estimate, or county assessed value.',
      'For financial accounts: use the most recent statement balance.',
      'For business interests: use the most recent valuation or book value.',
      'Update each asset record with the estimated value.',
    ],
    evidence_required: ['Account statement, appraisal, or valuation document'],
    done_definition: 'All assets have a non-zero estimated_value.',
    escalation_conditions: [
      'Business interest requires formal valuation (may need CPA or appraiser).',
      'Real estate value is disputed or unknown (may need appraisal).',
    ],
    owner_suggestion: 'self',
    estimated_complexity: 'low',
    estimated_time_minutes: 30,
    enabled: true,
  },

  {
    rule_id: 'nba-013',
    name: 'Clarify Unknown Funding Status',
    description: 'One or more assets have unknown funding status. You need to determine whether they are titled in the trust.',
    category: 'funding',
    trigger_type: 'gap',
    trigger_field: 'funding_status',
    trigger_operator: 'exists',
    trigger_value: '',
    risk_reduction: 40,
    equity_protected: 40,
    time_score: 70,
    dependency_unlock: 60,
    steps: [
      'For each asset with unknown status, check the current title or account registration.',
      'For real estate: pull a current title report or check county recorder records.',
      'For financial accounts: call the institution and ask how the account is titled.',
      'For business interests: review the operating agreement for trust references.',
      'Update each asset funding_status to funded, unfunded, or partial.',
    ],
    evidence_required: ['Title report, account statement, or institution confirmation'],
    done_definition: 'No assets remain with funding_status = unknown.',
    escalation_conditions: [
      'Institution cannot confirm title over the phone (may need in-person visit with Certificate of Trust).',
    ],
    owner_suggestion: 'self',
    estimated_complexity: 'low',
    estimated_time_minutes: 45,
    enabled: true,
  },

  {
    rule_id: 'nba-014',
    name: 'Add Trust County Information',
    description: 'The trust profile is missing county information. County is needed to determine local recording requirements and probate thresholds.',
    category: 'documents',
    trigger_type: 'gap',
    trigger_field: 'trust_profile.county',
    trigger_operator: 'exists',
    trigger_value: '',
    risk_reduction: 10,
    equity_protected: 5,
    time_score: 90,
    dependency_unlock: 15,
    steps: [
      'Determine the county where the trust was established (usually where the grantor resides).',
      'Update the trust profile with the correct county.',
    ],
    evidence_required: [],
    done_definition: 'Trust profile county field is not null.',
    escalation_conditions: [],
    owner_suggestion: 'self',
    estimated_complexity: 'low',
    estimated_time_minutes: 5,
    enabled: true,
  },

  {
    rule_id: 'nba-015',
    name: 'Verify Beneficiary Designations on Insurance/Retirement',
    description: 'Insurance or retirement accounts are missing beneficiary designation information. These assets pass by beneficiary, not by trust — the designation must be correct.',
    category: 'beneficiary',
    trigger_type: 'gap',
    trigger_field: 'beneficiary_designation',
    trigger_operator: 'exists',
    trigger_value: '',
    risk_reduction: 60,
    equity_protected: 55,
    time_score: 60,
    dependency_unlock: 20,
    steps: [
      'Contact each insurance company or retirement plan administrator.',
      'Request the current beneficiary designation on file.',
      'Verify it matches your intended beneficiary (individual or trust, per your estate plan).',
      'If it does not match, complete a new beneficiary designation form.',
      'Update the asset record with the correct beneficiary_designation.',
    ],
    evidence_required: ['Current beneficiary designation form or confirmation letter'],
    done_definition: 'All insurance and retirement assets have beneficiary_designation populated.',
    escalation_conditions: [
      'Retirement account naming trust as beneficiary may have tax implications (consult CPA).',
      'Insurance policy beneficiary change may require underwriting.',
    ],
    owner_suggestion: 'self',
    estimated_complexity: 'low',
    estimated_time_minutes: 30,
    enabled: true,
  },

  {
    rule_id: 'nba-016',
    name: 'Review Documents Needing Attention',
    description: 'One or more documents are flagged as needing review. These may be inaccurate, incomplete, or require attorney attention.',
    category: 'documents',
    trigger_type: 'gap',
    trigger_field: 'documents.status.needs_review',
    trigger_operator: 'exists',
    trigger_value: '',
    risk_reduction: 35,
    equity_protected: 25,
    time_score: 50,
    dependency_unlock: 30,
    steps: [
      'Review each document flagged as needs_review.',
      'Determine if the document needs updating, replacing, or re-executing.',
      'Consult your attorney for documents requiring legal changes.',
      'Update document status to complete or outdated based on review outcome.',
    ],
    evidence_required: ['Updated or re-executed document'],
    done_definition: 'No documents remain with status = needs_review.',
    escalation_conditions: [
      'Document reveals a legal issue (e.g., invalid notarization, missing witness).',
    ],
    owner_suggestion: 'attorney',
    estimated_complexity: 'medium',
    estimated_time_minutes: 60,
    enabled: true,
  },

  // ─── Incapacity Threshold Rule ─────────────────────────────────────────

  {
    rule_id: 'nba-017',
    name: 'Improve Incapacity Readiness',
    description: 'Incapacity readiness score is below 60%. You may not have adequate protections in place if you become unable to manage your own affairs.',
    category: 'incapacity',
    trigger_type: 'threshold',
    trigger_field: 'incapacity_readiness_score',
    trigger_operator: 'lt',
    trigger_value: '60',
    risk_reduction: 80,
    equity_protected: 30,
    time_score: 70,
    dependency_unlock: 55,
    steps: [
      'Review which incapacity components are missing (Healthcare Directive, Financial POA, Successor Trustee, Certificate of Trust).',
      'Address the missing components in order of importance.',
      'Consult your estate attorney for document drafting.',
      'Execute each document per state requirements.',
    ],
    evidence_required: ['Signed incapacity planning documents'],
    done_definition: 'incapacity_readiness_score >= 60%.',
    escalation_conditions: [
      'Grantor has existing health concerns that make this urgent.',
    ],
    owner_suggestion: 'attorney',
    estimated_complexity: 'high',
    estimated_time_minutes: 180,
    enabled: true,
  },
];
