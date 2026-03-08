export function exportCandidatesCSV(candidates) {
  const headers = [
    'Name', 'Email', 'Phone', 'Location', 'Current Title',
    'Experience (yrs)', 'Skills', 'Work Mode', 'Expected Salary',
    'Notice Period (days)', 'Uploaded Date'
  ];

  const rows = candidates.map(c => [
    c.full_name || '',
    c.email || '',
    c.phone || '',
    c.location || '',
    c.current_title || '',
    c.years_experience || '',
    (Array.isArray(c.skills) ? c.skills : []).join('; '),
    c.work_mode_preference || '',
    c.expected_salary || '',
    c.notice_period_days || '',
    c.created_at ? new Date(c.created_at).toLocaleDateString() : ''
  ]);

  return buildCSV(headers, rows);
}

export function exportMatchesCSV(matches, jdTitle = '') {
  const headers = [
    'Rank', 'Name', 'Email', 'Location', 'Current Title',
    'Experience (yrs)', 'Final Score', 'Skill Score', 'Experience Score',
    'Location Score', 'Salary Score', 'Work Mode Score',
    'Confidence', 'Missing Skills', 'Reason'
  ];

  const rows = matches.map((m, i) => {
    const c = m.candidates || m;
    return [
      i + 1,
      c.full_name || '',
      c.email || '',
      c.location || '',
      c.current_title || '',
      c.years_experience || '',
      m.final_score || '',
      m.skill_match_score || '',
      m.experience_score || '',
      m.location_score || '',
      m.salary_score || '',
      m.work_mode_score || '',
      m.confidence || '',
      (Array.isArray(m.missing_skills) ? m.missing_skills : []).join('; '),
      m.reason || ''
    ];
  });

  const filename = jdTitle
    ? `matches_${jdTitle.replace(/\s+/g, '_')}_${Date.now()}.csv`
    : `matches_${Date.now()}.csv`;

  downloadCSV(buildCSV(headers, rows), filename);
}

function buildCSV(headers, rows) {
  const escape = val => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [
    headers.map(escape).join(','),
    ...rows.map(row => row.map(escape).join(','))
  ];
  return lines.join('\n');
}

function downloadCSV(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
