(function () {
  var CFG = window.WOWPADEL_CONFIG || {};
  var POLL_MS = 30000;
  var pollTimer = null;

  // Kept in sync with src/types.ts FORMAT_META names.
  var FORMAT_NAMES = {
    americano: 'Americano',
    mexicano: 'Mexicano',
    mixicano: 'Mixicano',
    mix_americano: 'Mix Americano',
    team_americano: 'Team Americano',
    knockout: 'Knockout',
  };

  var shareId = new URLSearchParams(window.location.search).get('e');
  var lastUpdatedAt = null;
  var hasShownContent = false;
  var activeTab = 'rounds';

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
    roundsPane: document.getElementById('roundsPane'),
    standingsPane: document.getElementById('standingsPane'),
    updatedAt: document.getElementById('updatedAt'),
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
      if (row.updated_at === lastUpdatedAt) return; // no change, skip re-render
      render(row.payload, row.updated_at); // may throw on unexpected data shapes
      lastUpdatedAt = row.updated_at;
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

  function render(event, updatedAt) {
    els.eventName.textContent = event.name;
    els.eventMeta.textContent =
      (FORMAT_NAMES[event.format] || event.format) + ' · ' + event.players.length + ' players · ' + event.courts.length + ' courts';

    var isLive = event.status === 'live';
    els.statusPill.textContent = isLive ? 'LIVE' : 'ENDED';
    els.statusPill.className = 'pill' + (isLive ? '' : ' ended');

    if (event.format === 'knockout') renderKnockoutRounds(event);
    else renderRounds(event);
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

  function renderKnockoutRounds(event) {
    var html = '';
    event.rounds.forEach(function (round, ri) {
      var competitors = round.matches.length * 2;
      var isFirstRound = ri === 0;
      html += '<div class="round-block"><h2 class="round-title">' + esc(knockoutRoundName(competitors)) + '</h2>';
      round.matches.forEach(function (m) {
        html += renderKnockoutMatch(event, m, isFirstRound);
      });
      html += '</div>';
    });
    if (event.thirdPlaceMatch) {
      html += '<div class="round-block"><h2 class="round-title">3rd Place</h2>' + renderKnockoutMatch(event, event.thirdPlaceMatch, false) + '</div>';
    }
    els.roundsPane.innerHTML = html;
  }

  function scoreBoxClass(filled, win) {
    return 'score-box' + (filled ? (win ? ' win' : ' filled') : '');
  }

  function renderRounds(event) {
    var html = '';
    event.rounds.forEach(function (round) {
      var isCurrentRound = round.index === event.currentRoundIndex;
      html += '<div class="round-block"><h2 class="round-title">Round ' + round.index + '<span>of ' + event.totalRoundsEstimate + '</span></h2>';
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
          '<div class="' + scoreBoxClass(m.scoreA != null, winA) + '">' + (m.scoreA != null ? m.scoreA : '–') + '</div>' +
          '<span class="vs">vs</span>' +
          '<div class="' + scoreBoxClass(m.scoreB != null, winB) + '">' + (m.scoreB != null ? m.scoreB : '–') + '</div>' +
          '<div class="team right">' +
          m.teamB.map(function (pid) { return '<span class="player-line">' + esc(shortName(playerName(event.players, pid))) + '</span>'; }).join('') +
          '</div></div></div>';
      });
      if (round.sitOuts && round.sitOuts.length) {
        html +=
          '<p class="sit-outs">' +
          (event.format === 'team_americano' ? 'Bye this round: ' : 'Sitting out: ') +
          esc(round.sitOuts.map(function (id) { return playerName(event.players, id); }).join(', ')) +
          '</p>';
      }
      html += '</div>';
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

  showState('loading');
  fetchEvent();
  pollTimer = setInterval(fetchEvent, POLL_MS);
})();
