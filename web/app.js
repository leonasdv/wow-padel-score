(function () {
  var CFG = window.WOWPADEL_CONFIG || {};
  var POLL_MS = 5000;
  var pollTimer = null;

  // Kept in sync with src/types.ts FORMAT_META names.
  var FORMAT_NAMES = {
    americano: 'Americano',
    mexicano: 'Mexicano',
    mixicano: 'Mixicano',
    mix_americano: 'Mix Americano',
    team_americano: 'Team Americano',
    team_mexicano: 'Team Mexicano',
    knockout: 'Knockout',
  };

  // Kept in sync with isTeamFormat() in src/lib/tournament.ts.
  function isTeamFormat(format) {
    return format === 'team_americano' || format === 'team_mexicano';
  }

  var params = new URLSearchParams(window.location.search);
  var shareId = params.get('e');
  var editorToken = params.get('editor');
  var lastUpdatedAt = null;
  var lastInputSource = null;
  var lastPendingVersion = null;
  var hasShownContent = false;
  var activeTab = 'rounds';
  var currentEvent = null; // last-rendered payload — read by the score-tap handler

  var els = {
    loading: document.getElementById('stateLoading'),
    notFound: document.getElementById('stateNotFound'),
    errorState: document.getElementById('stateError'),
    errorMessage: document.getElementById('errorMessage'),
    content: document.getElementById('content'),
    statusPill: document.getElementById('statusPill'),
    eventName: document.getElementById('eventName'),
    eventMeta: document.getElementById('eventMeta'),
    tabRoundsBtn: document.getElementById('tabRoundsBtn'),
    tabStandingsBtn: document.getElementById('tabStandingsBtn'),
    editorBanner: document.getElementById('editorBanner'),
    roundsPane: document.getElementById('roundsPane'),
    standingsPane: document.getElementById('standingsPane'),
    updatedAt: document.getElementById('updatedAt'),
    scoreModalOverlay: document.getElementById('scoreModalOverlay'),
    scoreModalTitle: document.getElementById('scoreModalTitle'),
    scoreModalInput: document.getElementById('scoreModalInput'),
    scoreModalError: document.getElementById('scoreModalError'),
    scoreModalCancelBtn: document.getElementById('scoreModalCancelBtn'),
    scoreModalConfirmBtn: document.getElementById('scoreModalConfirmBtn'),
  };

  function showState(name, message) {
    els.loading.hidden = name !== 'loading';
    els.notFound.hidden = name !== 'notFound';
    els.errorState.hidden = name !== 'error';
    els.content.hidden = name !== 'content';
    if (name === 'error') els.errorMessage.textContent = message || 'Unknown error.';
  }

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function playerName(players, id) {
    var p = players.find(function (p) { return p.id === id; });
    return p ? p.name : '—';
  }

  function shortName(fullName) {
    var parts = (fullName || '').trim().split(/\s+/);
    if (parts.length < 2) return fullName;
    return parts[0] + ' ' + parts[parts.length - 1][0] + '.';
  }

  function leaguePointsPerMatch(s) {
    if (s.played === 0) return 0;
    return (s.wins * 3 + s.draws) / s.played;
  }

  function matchLosses(s) {
    return s.played - s.wins - s.draws;
  }

  async function fetchEvent() {
    if (!shareId) { showState('error', 'No event id in the link (missing ?e=...).'); return; }
    if (!CFG.supabaseUrl || !CFG.supabaseAnonKey) {
      showState('error', 'Page misconfigured: web/config.js is missing supabaseUrl/supabaseAnonKey.');
      return;
    }
    var controller = new AbortController();
    var timeoutId = setTimeout(function () { controller.abort(); }, 8000);
    try {
      var res = await fetch(CFG.supabaseUrl.replace(/\/$/, '') + '/rest/v1/rpc/get_shared_event', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          apikey: CFG.supabaseAnonKey,
          Authorization: 'Bearer ' + CFG.supabaseAnonKey,
        },
        body: JSON.stringify({ p_share_id: shareId }),
      });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error('Request failed: HTTP ' + res.status);
      var rows = await res.json();
      var row = Array.isArray(rows) ? rows[0] : rows;
      if (!row || !row.payload) { showState('notFound'); return; }
      // input_source can change without updated_at moving (a mode flip alone doesn't touch the
      // payload), and pending_version can advance without either of those moving too (a new score
      // just submitted from this same link, overlaid in by get_shared_event but not yet applied
      // by the organizer's app) — all three are checked so none of those changes go unnoticed.
      if (row.updated_at === lastUpdatedAt && row.input_source === lastInputSource && row.pending_version === lastPendingVersion) return;
      render(row.payload, row.updated_at, row.input_source); // may throw on unexpected data shapes
      lastUpdatedAt = row.updated_at;
      lastInputSource = row.input_source;
      lastPendingVersion = row.pending_version;
      hasShownContent = true;
      showState('content');
    } catch (err) {
      clearTimeout(timeoutId);
      console.error('Failed to load shared event', err);
      // Only replace what's on screen if we've never successfully shown anything yet —
      // a later poll failing shouldn't blow away a page that's already rendered fine.
      if (!hasShownContent) {
        var isTimeout = err && err.name === 'AbortError';
        var message = isTimeout
          ? 'Request to Supabase timed out after 8s — your network (WiFi/mobile data, VPN, or DNS filter) may be blocking ' + (CFG.supabaseUrl || 'the API') + '.'
          : String((err && err.message) || err);
        showState('error', message);
      }
    }
  }

  function render(event, updatedAt, inputSource) {
    currentEvent = event;
    els.eventName.textContent = event.name;
    els.eventMeta.textContent =
      (FORMAT_NAMES[event.format] || event.format) + ' · ' + event.players.length + ' players · ' + event.courts.length + ' courts';

    var isLive = event.status === 'live';
    els.statusPill.textContent = isLive ? 'LIVE' : 'ENDED';
    els.statusPill.className = 'pill' + (isLive ? '' : ' ended');

    // Score entry from this link only ever applies to the current round, and only while the
    // organizer has this event toggled to web input — never for knockout (out of scope for now).
    var canEditHere = !!editorToken && isLive && event.format !== 'knockout';
    var isEditable = canEditHere && inputSource === 'web';
    if (canEditHere && inputSource !== 'web') {
      els.editorBanner.textContent = 'Scores are being entered from the app right now — ask the organizer to switch to this web link.';
      els.editorBanner.hidden = false;
    } else {
      els.editorBanner.hidden = true;
    }

    if (event.format === 'knockout') renderKnockoutRounds(event);
    else renderRounds(event, isEditable);
    renderStandings(event);

    if (updatedAt) {
      var d = new Date(updatedAt);
      els.updatedAt.textContent = (isLive ? 'Updated ' : 'Final · ') + d.toLocaleTimeString();
    }

    // Finished (or not-yet-live) events won't change again — stop polling once we've shown them.
    if (!isLive) stopPolling();
  }

  // Kept in sync with knockoutRoundName() in src/lib/tournament.ts.
  function knockoutRoundName(competitorCount) {
    switch (competitorCount) {
      case 2: return 'Final';
      case 4: return 'Semi Finals';
      case 8: return 'Quarter Finals';
      case 16: return 'Round of 16';
      case 32: return 'Round of 32';
      default: return 'Round of ' + competitorCount;
    }
  }

  // Mirrors KnockoutScreen.tsx's scoreBox()/renderColumns()/renderThirdPlace() — a
  // single-elimination bracket, not the flat per-court rounds list other formats use.
  // Rendered as stacked sections (one per round) rather than side-by-side bracket
  // columns, which reads better on a narrow share-page than replicating the app's
  // connecting-line bracket geometry in plain CSS.
  function renderKnockoutMatch(event, m, isFirstRound) {
    function slot(id, otherId, score, otherScore) {
      var decided = score != null && otherScore != null && score !== otherScore;
      var isWinner = decided && score > otherScore;
      var isBye = !!id && !otherId && isFirstRound;
      var label = id ? esc(shortName(playerName(event.players, id))) : 'TBD';
      var scoreHtml = isBye
        ? '<span class="ko-bye">BYE</span>'
        : '<span class="' + scoreBoxClass(score != null, isWinner) + ' ko-score">' + (score != null ? score : '–') + '</span>';
      return (
        '<div class="ko-slot' + (isWinner ? ' ko-slot-winner' : '') + '">' +
        '<span class="ko-name' + (!id ? ' ko-tbd' : '') + '">' + label + '</span>' +
        scoreHtml +
        '</div>'
      );
    }
    var idA = m.teamA[0], idB = m.teamB[0];
    return (
      '<div class="ko-card">' +
      slot(idA, idB, m.scoreA, m.scoreB) +
      slot(idB, idA, m.scoreB, m.scoreA) +
      '</div>'
    );
  }

  // Exact geometry from KnockoutScreen.tsx so the bracket lines up the same way as
  // the app: each round's cards sit vertically centered between their two feeders.
  var KO_CARD_H = 72;
  var KO_GAP0 = 18;
  var KO_UNIT = KO_CARD_H + KO_GAP0;
  var KO_COL_W = 190;

  function knockoutChampion(event) {
    if (event.status !== 'done' || !event.rounds.length) return null;
    var finalMatch = event.rounds[event.rounds.length - 1].matches[0];
    if (!finalMatch || finalMatch.scoreA == null || finalMatch.scoreB == null) return null;
    var winnerId = finalMatch.scoreA > finalMatch.scoreB ? finalMatch.teamA[0] : finalMatch.teamB[0];
    return winnerId ? playerName(event.players, winnerId) : null;
  }

  function renderKnockoutRounds(event) {
    var html = '';
    var champion = knockoutChampion(event);
    if (champion) {
      html += '<div class="ko-champ-banner">🏆 Champion: ' + esc(champion) + '</div>';
    }
    html += '<div class="ko-bracket-scroll"><div class="ko-bracket">';
    event.rounds.forEach(function (round, ri) {
      var competitors = round.matches.length * 2;
      var isFirstRound = ri === 0;
      var pitch = KO_UNIT * Math.pow(2, ri);
      var paddingTop = pitch / 2 - KO_CARD_H / 2;
      var gap = pitch - KO_CARD_H;
      html += '<div class="ko-col" style="width:' + KO_COL_W + 'px">';
      html += '<div class="ko-col-title">' + esc(knockoutRoundName(competitors)) + '</div>';
      html += '<div class="ko-col-body" style="padding-top:' + paddingTop + 'px; gap:' + gap + 'px">';
      round.matches.forEach(function (m) {
        html += renderKnockoutMatch(event, m, isFirstRound);
      });
      html += '</div></div>';
    });
    html += '</div></div>';
    if (event.thirdPlaceMatch) {
      html +=
        '<div class="ko-third-wrap"><div class="ko-third-label">🥉 3rd Place Playoff</div>' +
        '<div style="width:' + KO_COL_W + 'px">' + renderKnockoutMatch(event, event.thirdPlaceMatch, false) + '</div></div>';
    }
    els.roundsPane.innerHTML = html;
    // Only show the "more to scroll" fade when the bracket is actually wider than the viewport.
    var scroller = els.roundsPane.querySelector('.ko-bracket-scroll');
    if (scroller) scroller.classList.toggle('has-overflow', scroller.scrollWidth > scroller.clientWidth + 1);
  }

  function scoreBoxClass(filled, win) {
    return 'score-box' + (filled ? (win ? ' win' : ' filled') : '');
  }

  // `editable` is only ever true for the match's own round (renderRounds only passes it for the
  // current round) — score entry from the web link never touches a past or future round.
  function scoreBoxHtml(roundIndex, courtId, team, value, filled, win, editable) {
    var text = filled ? value : '–';
    var boxId = 'score-' + roundIndex + '-' + courtId + '-' + team;
    if (!editable) return '<div class="' + scoreBoxClass(filled, win) + '" id="' + boxId + '">' + text + '</div>';
    var cls = scoreBoxClass(filled, win) + ' editable';
    var onclick = "window.__wowScoreTap(" + roundIndex + ",'" + courtId + "','" + team + "'," + (filled ? value : 'null') + ')';
    return '<div class="' + cls + '" id="' + boxId + '" onclick="' + onclick + '">' + text + '</div>';
  }

  // Renders one round's block — every court's card side by side in a grid, so on a wide
  // (laptop) viewport the whole round's live matches fit on one screen instead of a long scroll.
  function renderRoundBlock(event, round, isEditable, isCurrentRound) {
    var html =
      '<div class="round-block' + (isCurrentRound ? ' round-current' : ' round-past') + '">' +
      '<h2 class="round-title">Round ' + round.index + '<span>of ' + event.totalRoundsEstimate + '</span>' +
      (isCurrentRound ? '<span class="round-live-tag">LIVE NOW</span>' : '') +
      '</h2><div class="courts-grid">';
    event.courts.forEach(function (court) {
      var m = round.matches.find(function (mm) { return mm.courtId === court.id; });
      if (!m) {
        html +=
          '<div class="court-card"><div class="court-top"><span class="court-name">' +
          esc(court.name) +
          '</span><span class="status-badge status-idle">IDLE</span></div><p class="idle-text">No match this round</p></div>';
        return;
      }
      var done = m.scoreA != null && m.scoreB != null;
      var winA = done && m.scoreA > m.scoreB;
      var winB = done && m.scoreB > m.scoreA;
      var status = done ? 'DONE' : isCurrentRound ? 'LIVE' : 'WAITING';
      var statusClass = done ? 'status-done' : isCurrentRound ? 'status-live' : 'status-waiting';
      var editableHere = isEditable && isCurrentRound;

      html +=
        '<div class="court-card"><div class="court-top"><span class="court-name">' +
        esc(court.name) +
        '</span><span class="status-badge ' +
        statusClass +
        '">' +
        status +
        '</span></div><div class="match-row">' +
        '<div class="team">' +
        m.teamA.map(function (pid) { return '<span class="player-line">' + esc(shortName(playerName(event.players, pid))) + '</span>'; }).join('') +
        '</div>' +
        scoreBoxHtml(round.index, court.id, 'A', m.scoreA, m.scoreA != null, winA, editableHere) +
        '<span class="vs">vs</span>' +
        scoreBoxHtml(round.index, court.id, 'B', m.scoreB, m.scoreB != null, winB, editableHere) +
        '<div class="team right">' +
        m.teamB.map(function (pid) { return '<span class="player-line">' + esc(shortName(playerName(event.players, pid))) + '</span>'; }).join('') +
        '</div></div></div>';
    });
    html += '</div>';
    if (round.sitOuts && round.sitOuts.length) {
      html +=
        '<p class="sit-outs">' +
        (isTeamFormat(event.format) ? 'Bye this round: ' : 'Sitting out: ') +
        esc(round.sitOuts.map(function (id) { return playerName(event.players, id); }).join(', ')) +
        '</p>';
    }
    html += '</div>';
    return html;
  }

  // The live round always renders first — regardless of how many rounds have already been
  // played, the courts you actually care about right now are never buried below a long scroll
  // of finished ones. Past (and any already-generated future) rounds still follow below it.
  function renderRounds(event, isEditable) {
    // A finished event has no "live" round left to promote — currentRoundIndex still points at
    // whichever round finished last, but it's just as past as every other one now.
    var isLiveEvent = event.status === 'live';
    var currentRound = isLiveEvent ? event.rounds.find(function (r) { return r.index === event.currentRoundIndex; }) : null;
    var otherRounds = currentRound ? event.rounds.filter(function (r) { return r.index !== event.currentRoundIndex; }) : event.rounds;
    var html = '';
    if (currentRound) html += renderRoundBlock(event, currentRound, isEditable, true);
    otherRounds.forEach(function (round) {
      html += renderRoundBlock(event, round, isEditable, false);
    });
    els.roundsPane.innerHTML = html;
  }

  function renderStandings(event) {
    var standings = event.standings || [];
    var html =
      '<div class="table-header">' +
      '<span class="th" style="width:34px">#</span>' +
      '<span class="th" style="flex:1">Player</span>' +
      '<span class="th" style="width:24px">P</span>' +
      '<span class="th" style="width:24px">W</span>' +
      '<span class="th" style="width:24px">T</span>' +
      '<span class="th" style="width:24px">L</span>' +
      '<span class="th" style="width:38px">PPM</span>' +
      '<span class="th" style="width:40px;text-align:right">Pts</span>' +
      '</div>';
    standings.forEach(function (s, i) {
      var top = i < 3;
      var medal = ['#FFD34E', '#C9D6E5', '#E39A5B'][i];
      html +=
        '<div class="stand-row' + (top ? ' top' : '') + '">' +
        '<div class="rank-badge"' + (top ? ' style="background:' + medal + ';color:#0B1E3B"' : '') + '>' + (i + 1) + '</div>' +
        '<div class="stand-name-wrap">' +
        '<span class="gender-dot" style="background:' + (s.player.gender === 'M' ? 'var(--male)' : 'var(--female)') + '"></span>' +
        '<span class="stand-name">' + esc(s.player.name) + '</span>' +
        '</div>' +
        '<span class="stand-cell" style="width:24px;color:var(--text-muted)">' + s.played + '</span>' +
        '<span class="stand-cell" style="width:24px;font-weight:700">' + s.wins + '</span>' +
        '<span class="stand-cell" style="width:24px;color:var(--text-muted)">' + s.draws + '</span>' +
        '<span class="stand-cell" style="width:24px;color:var(--text-muted)">' + matchLosses(s) + '</span>' +
        '<span class="stand-cell" style="width:38px;color:var(--text-muted);font-size:12px">' + leaguePointsPerMatch(s).toFixed(2) + '</span>' +
        '<span class="stand-pts" style="width:40px;color:' + (top ? 'var(--lime)' : 'var(--text-primary)') + '">' + s.points + '</span>' +
        '</div>';
    });
    els.standingsPane.innerHTML = html;
  }

  function setTab(tab) {
    activeTab = tab;
    els.tabRoundsBtn.classList.toggle('active', tab === 'rounds');
    els.tabStandingsBtn.classList.toggle('active', tab === 'standings');
    els.roundsPane.hidden = tab !== 'rounds';
    els.standingsPane.hidden = tab !== 'standings';
  }

  els.tabRoundsBtn.addEventListener('click', function () { setTab('rounds'); });
  els.tabStandingsBtn.addEventListener('click', function () { setTab('standings'); });

  function stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  // ---- Score entry (only reachable when render() decided isEditable was true for this box) ----

  var scoreModalState = null; // { roundIndex, courtId, team }

  function matchLabel(roundIndex, courtId, team) {
    if (!currentEvent) return 'Score';
    var round = currentEvent.rounds.find(function (r) { return r.index === roundIndex; });
    var m = round && round.matches.find(function (mm) { return mm.courtId === courtId; });
    if (!m) return 'Score';
    var side = team === 'A' ? m.teamA : m.teamB;
    return side.map(function (pid) { return shortName(playerName(currentEvent.players, pid)); }).join(' & ');
  }

  // Exposed on window because scoreBoxHtml() wires it up via an inline onclick attribute, which
  // always runs in global scope — everything else in this file stays inside the IIFE closure.
  window.__wowScoreTap = function (roundIndex, courtId, team, currentValue) {
    scoreModalState = { roundIndex: roundIndex, courtId: courtId, team: team };
    els.scoreModalTitle.textContent = matchLabel(roundIndex, courtId, team) + ' · Round ' + roundIndex;
    els.scoreModalInput.value = currentValue == null ? '' : currentValue;
    els.scoreModalError.hidden = true;
    els.scoreModalOverlay.hidden = false;
    els.scoreModalInput.focus();
  };

  function closeScoreModal() {
    els.scoreModalOverlay.hidden = true;
    scoreModalState = null;
  }

  async function confirmScoreModal() {
    if (!scoreModalState) return;
    var value = Number(els.scoreModalInput.value);
    if (!Number.isFinite(value) || value < 0 || els.scoreModalInput.value.trim() === '') {
      els.scoreModalError.textContent = 'Enter a valid score.';
      els.scoreModalError.hidden = false;
      return;
    }
    var state = scoreModalState;
    els.scoreModalConfirmBtn.disabled = true;
    try {
      var res = await fetch(CFG.supabaseUrl.replace(/\/$/, '') + '/rest/v1/rpc/submit_shared_score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: CFG.supabaseAnonKey, Authorization: 'Bearer ' + CFG.supabaseAnonKey },
        body: JSON.stringify({
          p_share_id: shareId,
          p_editor_token: editorToken,
          p_round_index: state.roundIndex,
          p_court_id: state.courtId,
          p_team: state.team,
          p_value: Math.round(value),
        }),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var accepted = await res.json();
      if (accepted === false) throw new Error('Score entry just switched back to the app — ask the organizer to hand it back to this link.');
      closeScoreModal();
      // Mark the box as syncing rather than pretending the value is already final — the
      // organizer's app still has to pull this submission and apply it before it's official.
      var box = document.getElementById('score-' + state.roundIndex + '-' + state.courtId + '-' + state.team);
      if (box) { box.textContent = '…'; box.className = 'score-box pending'; }
      fetchEvent();
    } catch (e) {
      els.scoreModalError.textContent = 'Could not submit: ' + ((e && e.message) || e);
      els.scoreModalError.hidden = false;
    } finally {
      els.scoreModalConfirmBtn.disabled = false;
    }
  }

  els.scoreModalCancelBtn.addEventListener('click', closeScoreModal);
  els.scoreModalConfirmBtn.addEventListener('click', confirmScoreModal);
  els.scoreModalOverlay.addEventListener('click', function (e) {
    if (e.target === els.scoreModalOverlay) closeScoreModal();
  });
  els.scoreModalInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') confirmScoreModal();
  });

  showState('loading');
  fetchEvent();
  pollTimer = setInterval(fetchEvent, POLL_MS);
})();
