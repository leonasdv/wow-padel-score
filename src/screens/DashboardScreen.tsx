import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AddPlayerModal } from '../components/AddPlayerModal';
import { Button } from '../components/Button';
import { IconButton, LivePulseDot, ScreenBackground } from '../components/Misc';
import { PlayerPickerModal } from '../components/PlayerPickerModal';
import { ScoreKeypad } from '../components/ScoreKeypad';
import { SegmentedTabs } from '../components/SegmentedTabs';
import { TiebreakInfoModal, type TiebreakEntry } from '../components/TiebreakInfoModal';
import { useEvents } from '../data/store';
import { Alert } from '../lib/alert';
import { shareOrCopyLink } from '../lib/clipboard';
import { makeId } from '../lib/id';
import { publishEvent, shareUrlFor } from '../lib/share';
import {
  addPlayerMidEvent,
  advanceRound,
  applyScore,
  clearScore,
  computeStandings,
  describeTiebreak,
  extendRounds,
  isRankingBased,
  isTeamFormat,
  leaguePointsPerMatch,
  matchLosses,
  reopenEvent,
  reshuffleUpcoming,
  sortStandings,
  substituteParticipant,
} from '../lib/tournament';
import type { RootStackParamList } from '../navigation/types';
import type { ColorPalette } from '../theme/tokens';
import { radius } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
import { FORMAT_META, type Gender, type Match, type Round } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type R = RouteProp<RootStackParamList, 'Dashboard'>;

function playerName(players: { id: string; name: string }[], id: string): string {
  return players.find((p) => p.id === id)?.name ?? '—';
}

function shortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return fullName;
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

interface PlayerRoundEntry {
  round: Round;
  match: Match;
  onTeamA: boolean;
}

/** Every round a player actually played in — skips rounds they sat out and rounds from before they joined. */
function matchesForPlayer(rounds: Round[], playerId: string): PlayerRoundEntry[] {
  const entries: PlayerRoundEntry[] = [];
  for (const round of rounds) {
    const match = round.matches.find((m) => m.teamA.includes(playerId) || m.teamB.includes(playerId));
    if (match) entries.push({ round, match, onTeamA: match.teamA.includes(playerId) });
  }
  return entries;
}

export function DashboardScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<R>();
  const { getEvent, updateEvent, syncSharedScores } = useEvents();
  const event = getEvent(route.params.eventId);
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [tab, setTab] = useState<'rounds' | 'standings'>(route.params.tab ?? 'rounds');
  const [sortBy, setSortBy] = useState<'points' | 'wins'>('points');
  const [edit, setEdit] = useState<{ round: number; courtId: string; team: 'A' | 'B' } | null>(null);
  const [buffer, setBuffer] = useState('');
  const [addPlayerVisible, setAddPlayerVisible] = useState(false);
  const [swapOutgoing, setSwapOutgoing] = useState<{ id: string; round: number } | null>(null);
  const [tiebreakInfo, setTiebreakInfo] = useState<{ playerName: string; points: number; entries: TiebreakEntry[] } | null>(null);
  const [roundsSearch, setRoundsSearch] = useState('');
  const [shareBusy, setShareBusy] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);

  const searchResults = useMemo(() => {
    const q = roundsSearch.trim().toLowerCase();
    if (!q || !event) return [];
    return event.players.filter((p) => p.name.toLowerCase().includes(q));
  }, [event, roundsSearch]);

  const standings = useMemo(() => {
    if (!event) return [];
    return sortStandings(computeStandings(event), sortBy, event.rounds);
  }, [event, sortBy]);

  // Jump to the standings tab whenever the event finishes, whether that's from the manual
  // "Finish event" action or the last round auto-advancing once every court is scored.
  const prevStatusRef = useRef(event?.status);
  useEffect(() => {
    if (prevStatusRef.current === 'live' && event?.status === 'done') {
      setTab('standings');
    }
    prevStatusRef.current = event?.status;
  }, [event?.status]);

  if (!event) {
    return (
      <ScreenBackground>
        <SafeAreaView style={styles.safe}>
          <Text style={{ color: colors.textPrimary, padding: 24 }}>Event not found.</Text>
        </SafeAreaView>
      </ScreenBackground>
    );
  }

  const onShareLive = async () => {
    if (shareBusy) return;
    setShareBusy(true);
    try {
      let target = event;
      if (!target.shareId) {
        const published = await publishEvent(target);
        await updateEvent(event.id, () => published);
        target = published;
      }
      await shareOrCopyLink(shareUrlFor(target.shareId!));
    } catch (err: any) {
      Alert.alert('Something went wrong', err?.message ?? 'Could not create the share link. Check your connection and try again.');
    } finally {
      setShareBusy(false);
    }
  };

  const currentRound: Round | undefined = event.rounds.find((r) => r.index === event.currentRoundIndex);
  const allScored = currentRound ? currentRound.matches.every((m) => m.scoreA != null && m.scoreB != null) : false;
  const isLastRound = event.currentRoundIndex >= event.totalRoundsEstimate;
  // The web link is never the *only* place scores can be entered — the app can always edit or
  // clear a score too, toggle or no toggle. That's a deliberate choice: whichever side writes last
  // wins for that one match, and the organizer's phone is trusted to know when that's fine. The
  // toggle only decides where the web link itself is allowed to submit from; it was never meant to
  // lock the app out of its own event.
  const inputIsWeb = event.shareInputSource === 'web';

  const onSyncNow = async () => {
    setSyncBusy(true);
    try {
      await syncSharedScores(event.id);
    } finally {
      setSyncBusy(false);
    }
  };

  const openEdit = (m: Match, team: 'A' | 'B', roundIndex: number) => {
    const cur = team === 'A' ? m.scoreA : m.scoreB;
    setEdit({ round: roundIndex, courtId: m.courtId, team });
    setBuffer(cur != null ? String(cur) : '');
  };

  const closeEdit = () => {
    setEdit(null);
    setBuffer('');
  };

  const confirmScore = async () => {
    if (!edit) return;
    const value = buffer === '' ? 0 : Number(buffer);
    const { round: roundIndex, courtId, team } = edit;
    await updateEvent(event.id, (e) => applyScore(e, roundIndex, courtId, team, value));
    closeEdit();
  };

  const clearMatchScore = () => {
    if (!edit) return;
    const { round: roundIndex, courtId } = edit;
    const willRewind = !(roundIndex >= event.currentRoundIndex && event.status === 'live');
    const isAppendedFromStandings = event.format === 'team_mexicano' || isRankingBased(event.format);
    const message = !willRewind
      ? 'Both scores for this match go back to unscored.'
      : isAppendedFromStandings
        ? `Both scores go back to unscored, and Round ${roundIndex} becomes live again — every round after it will be regenerated once you replay through, since their pairings were based on the score you're clearing.`
        : `Both scores go back to unscored, and Round ${roundIndex} becomes live again.`;
    Alert.alert('Clear this score?', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          await updateEvent(event.id, (e) => clearScore(e, roundIndex, courtId));
          closeEdit();
        },
      },
    ]);
  };

  const onEndRound = async () => {
    const finishing = isLastRound;
    const proceed = async () => {
      await updateEvent(event.id, (e) => advanceRound(e));
      if (finishing) {
        setTab('standings');
      }
    };
    if (!allScored) {
      Alert.alert(
        'Some courts have no score yet',
        "Unscored matches won't count toward standings. " + (finishing ? 'Finish the event anyway?' : 'End the round anyway?'),
        [
          { text: 'Cancel', style: 'cancel' },
          { text: finishing ? 'Finish event' : 'End round', onPress: proceed },
        ]
      );
      return;
    }
    proceed();
  };

  const onAddRounds = () => {
    Alert.alert('Add rounds', 'How many more rounds would you like to add?', [
      { text: 'Cancel', style: 'cancel' },
      { text: '+1', onPress: () => updateEvent(event.id, (e) => extendRounds(e, 1)) },
      { text: '+3', onPress: () => updateEvent(event.id, (e) => extendRounds(e, 3)) },
      { text: '+5', onPress: () => updateEvent(event.id, (e) => extendRounds(e, 5)) },
    ]);
  };

  const onReshuffle = () => {
    const completedCount = event.rounds.filter((r) => r.completed).length;
    Alert.alert(
      'Reshuffle upcoming rounds?',
      `Rounds ${completedCount + 1}–${event.totalRoundsEstimate} will be regenerated with fresh matchups. Completed rounds and standings stay untouched.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reshuffle', onPress: () => updateEvent(event.id, (e) => reshuffleUpcoming(e)) },
      ]
    );
  };

  const onEndEvent = () => {
    Alert.alert('End event now?', 'This finishes the tournament and locks in the current standings.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End event',
        style: 'destructive',
        onPress: async () => {
          await updateEvent(event.id, (e) => ({ ...e, status: 'done' }));
          setTab('standings');
        },
      },
    ]);
  };

  const onReopenEvent = () => {
    Alert.alert('Reopen this event?', 'It goes back to live so you can fix scores or keep playing.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reopen',
        onPress: async () => {
          await updateEvent(event.id, (e) => reopenEvent(e));
          setTab('rounds');
        },
      },
    ]);
  };

  const entityWord = isTeamFormat(event.format) ? 'team' : 'player';
  const regenerationText = isRankingBased(event.format) || event.format === 'team_mexicano'
    ? `Adding a ${entityWord} now will affect pairings once Round ${event.currentRoundIndex} ends. Completed rounds and current standings stay untouched.`
    : `Adding a ${entityWord} now will regenerate upcoming rounds (${event.currentRoundIndex + 1}–${event.totalRoundsEstimate}). Completed rounds and current standings stay untouched.`;

  const onAddPlayer = async (name: string, gender: Gender) => {
    setAddPlayerVisible(false);
    await updateEvent(event.id, (e) => addPlayerMidEvent(e, { id: makeId('player'), name, gender }));
  };

  const openSwap = (id: string, roundIndex: number) => setSwapOutgoing({ id, round: roundIndex });

  const swapCandidates = (() => {
    if (!swapOutgoing) return [];
    const round = event.rounds.find((r) => r.index === swapOutgoing.round);
    if (!round) return [];
    const thisMatch = round.matches.find((m) => m.teamA.includes(swapOutgoing.id) || m.teamB.includes(swapOutgoing.id));
    const excluded = new Set([swapOutgoing.id, ...(thisMatch ? [...thisMatch.teamA, ...thisMatch.teamB] : [])]);
    return event.players
      .filter((p) => !excluded.has(p.id))
      .map((p) => {
        if (round.sitOuts.includes(p.id)) return { id: p.id, name: p.name, tag: 'Sitting out' };
        const court = event.courts.find((c) => round.matches.some((m) => m.courtId === c.id && (m.teamA.includes(p.id) || m.teamB.includes(p.id))));
        return { id: p.id, name: p.name, tag: court ? court.name : undefined };
      });
  })();

  const confirmSwap = async (incomingId: string) => {
    if (!swapOutgoing) return;
    const { id: outgoingId } = swapOutgoing;
    setSwapOutgoing(null);
    await updateEvent(event.id, (e) => substituteParticipant(e, outgoingId, incomingId));
  };

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <View style={styles.headRow}>
            <IconButton name="chevron-back" onPress={() => nav.navigate('MainTabs')} />
            <View style={styles.headActions}>
              <Pressable style={[styles.livePill, event.status !== 'live' && styles.endedPill]}>
                {event.status === 'live' && <LivePulseDot />}
                <Text style={[styles.liveText, event.status !== 'live' && styles.endedText]}>{event.status === 'live' ? 'LIVE' : 'ENDED'}</Text>
              </Pressable>
              {inputIsWeb && (
                <Pressable style={styles.syncPill} onPress={onSyncNow} disabled={syncBusy}>
                  <Ionicons name={syncBusy ? 'hourglass-outline' : 'sync-outline'} size={13} color={colors.blueText} />
                  <Text style={styles.syncPillText}>Sync</Text>
                </Pressable>
              )}
              {event.status === 'live' && <IconButton name="shuffle-outline" size={38} onPress={onReshuffle} />}
              <IconButton name="ellipsis-horizontal" size={38} onPress={() => nav.navigate('EditEvent', { eventId: event.id })} />
            </View>
          </View>
          <Text style={styles.title} numberOfLines={1}>
            {event.name}
          </Text>
          <Text style={styles.meta}>
            {FORMAT_META[event.format].name} · {event.players.length} players · {event.courts.length} courts
          </Text>
        </View>

        <View style={styles.tabsWrap}>
          <SegmentedTabs
            options={[
              { key: 'rounds', label: 'Rounds' },
              { key: 'standings', label: 'Standings' },
            ]}
            value={tab}
            onChange={(k) => setTab(k as 'rounds' | 'standings')}
          />
        </View>

        {/* Both tabs stay mounted (hidden via display:none) so each ScrollView keeps its scroll position when switching tabs. */}
        <View style={[styles.tabContent, tab !== 'rounds' && styles.tabHidden]}>
            <View style={styles.searchRow}>
              <Ionicons name="search" size={16} color={colors.textFaint} />
              <TextInput
                style={styles.searchInput}
                value={roundsSearch}
                onChangeText={setRoundsSearch}
                placeholder="Search a player to see their matches…"
                placeholderTextColor={colors.textFaint}
                returnKeyType="search"
              />
              {!!roundsSearch && (
                <Pressable onPress={() => setRoundsSearch('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={16} color={colors.textFaint} />
                </Pressable>
              )}
            </View>

            {roundsSearch.trim() !== '' ? (
              <ScrollView style={styles.scroll} contentContainerStyle={styles.standingsList}>
                {searchResults.length === 0 ? (
                  <Text style={styles.emptySearch}>No player found matching "{roundsSearch.trim()}".</Text>
                ) : (
                  searchResults.map((p) => {
                    const entries = matchesForPlayer(event.rounds, p.id);
                    return (
                      <View key={p.id} style={styles.playerHistoryCard}>
                        <View style={styles.playerHistoryHead}>
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: p.gender === 'M' ? colors.male : colors.female }} />
                          <Text style={styles.playerHistoryName}>{p.name}</Text>
                        </View>
                        {entries.length === 0 ? (
                          <Text style={styles.emptySearch}>No matches played yet for {p.name}.</Text>
                        ) : (
                          entries.map((entry, idx) => {
                            const m = entry.match;
                            const onTeamA = entry.onTeamA;
                            const own = onTeamA ? m.teamA : m.teamB;
                            const opp = onTeamA ? m.teamB : m.teamA;
                            const teammates = own.filter((id) => id !== p.id);
                            const ownScore = onTeamA ? m.scoreA : m.scoreB;
                            const oppScore = onTeamA ? m.scoreB : m.scoreA;
                            const played = ownScore != null && oppScore != null;
                            const court = event.courts.find((c) => c.id === m.courtId);
                            let resultLabel = 'Pending';
                            let resultColor: string = colors.textFaint;
                            if (played) {
                              if (ownScore! > oppScore!) {
                                resultLabel = 'Win';
                                resultColor = colors.win;
                              } else if (ownScore! < oppScore!) {
                                resultLabel = 'Loss';
                                resultColor = colors.lose;
                              } else {
                                resultLabel = 'Tie';
                                resultColor = colors.tie;
                              }
                            }
                            return (
                              <View key={idx} style={styles.historyRow}>
                                <View style={{ flex: 1, minWidth: 0 }}>
                                  <Text style={styles.historyRound}>
                                    Round {entry.round.index}
                                    {court ? ` · ${court.name}` : ''}
                                  </Text>
                                  <Text style={styles.historyMatchup} numberOfLines={1}>
                                    {teammates.length > 0 ? `w/ ${teammates.map((id) => shortName(playerName(event.players, id))).join(' & ')} ` : ''}
                                    vs {opp.map((id) => shortName(playerName(event.players, id))).join(' & ')}
                                  </Text>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                  <Text style={styles.historyScore}>{played ? `${ownScore} - ${oppScore}` : '—'}</Text>
                                  <Text style={[styles.historyResult, { color: resultColor }]}>{resultLabel}</Text>
                                </View>
                              </View>
                            );
                          })
                        )}
                      </View>
                    );
                  })
                )}
              </ScrollView>
            ) : (
              <ScrollView style={styles.scroll} contentContainerStyle={styles.body}>
              {event.rounds.map((round) => {
                const isCurrentRound = round.index === event.currentRoundIndex;
                return (
                  <View key={round.index} style={styles.roundBlock}>
                    <View style={styles.roundNav}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Text style={styles.roundTitle}>Round {round.index}</Text>
                        <Text style={styles.roundOf}>of {event.totalRoundsEstimate}</Text>
                      </View>
                    </View>

                    {event.courts.map((court) => {
                      const m = round.matches.find((match) => match.courtId === court.id);
                      if (!m) {
                        return (
                          <View key={court.id} style={[styles.courtCard, styles.courtCardIdle]}>
                            <View style={styles.courtTop}>
                              <Text style={[styles.courtName, { color: colors.textFaint }]}>{court.name}</Text>
                              <View style={[styles.statusBadge, { backgroundColor: colors.white06 }]}>
                                <Text style={[styles.statusText, { color: colors.textFaint }]}>IDLE</Text>
                              </View>
                            </View>
                            <Text style={styles.idleText}>No match this round</Text>
                          </View>
                        );
                      }
                      const done = m.scoreA != null && m.scoreB != null;
                      const winA = done && (m.scoreA as number) > (m.scoreB as number);
                      const winB = done && (m.scoreB as number) > (m.scoreA as number);
                      const webAlsoWritesHere = isCurrentRound && inputIsWeb;
                      // Only the active round is LIVE (or WEB, when the web link can also submit scores for it — the app can still enter/clear here too); rounds ahead of it are WAITING.
                      const status = done ? 'DONE' : isCurrentRound ? (webAlsoWritesHere ? 'WEB' : 'LIVE') : 'WAITING';
                      const statusStyle =
                        status === 'DONE'
                          ? { bg: 'rgba(198,234,59,.14)', fg: colors.lime, border: colors.hairline }
                          : status === 'LIVE' || status === 'WEB'
                            ? { bg: colors.blueTint, fg: colors.blueText, border: colors.blueTintBorder }
                            : { bg: 'rgba(255,180,60,.14)', fg: colors.amber, border: colors.hairline };
                      const boxStyle = (filled: boolean, win: boolean) => ({
                        backgroundColor: filled ? (win ? 'rgba(198,234,59,.16)' : colors.surfaceSunken) : colors.white05,
                        borderColor: win ? colors.lime : colors.hairlineStrong,
                        color: filled ? (win ? colors.lime : colors.textPrimary) : colors.textGhost,
                      });
                      const boxA = boxStyle(m.scoreA != null, winA);
                      const boxB = boxStyle(m.scoreB != null, winB);
                      return (
                        <View
                          key={m.courtId}
                          style={[styles.courtCard, { borderColor: statusStyle.border }]}
                        >
                          <View style={styles.courtTop}>
                            <Text style={styles.courtName}>{court.name}</Text>
                            <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                              <Text style={[styles.statusText, { color: statusStyle.fg }]}>{status}</Text>
                            </View>
                          </View>
                          <View style={styles.matchRow}>
                            <View style={{ flex: 1, minWidth: 0 }}>
                              {m.teamA.map((pid) => (
                                <Pressable key={pid} style={styles.playerTag} onPress={() => openSwap(pid, round.index)} hitSlop={6}>
                                  <Text style={styles.playerLine} numberOfLines={1}>
                                    {shortName(playerName(event.players, pid))}
                                  </Text>
                                  <Ionicons name="pencil" size={9} color={colors.textFaint} style={styles.playerEditIcon} />
                                </Pressable>
                              ))}
                            </View>
                            <Pressable
                              onPress={() => openEdit(m, 'A', round.index)}
                              style={[
                                styles.scoreBox,
                                { backgroundColor: boxA.backgroundColor, borderColor: boxA.borderColor },
                                webAlsoWritesHere && styles.scoreBoxShared,
                              ]}
                            >
                              <Text style={[styles.scoreText, { color: boxA.color }]}>{m.scoreA ?? '–'}</Text>
                            </Pressable>
                            <Text style={styles.vs}>vs</Text>
                            <Pressable
                              onPress={() => openEdit(m, 'B', round.index)}
                              style={[
                                styles.scoreBox,
                                { backgroundColor: boxB.backgroundColor, borderColor: boxB.borderColor },
                                webAlsoWritesHere && styles.scoreBoxShared,
                              ]}
                            >
                              <Text style={[styles.scoreText, { color: boxB.color }]}>{m.scoreB ?? '–'}</Text>
                            </Pressable>
                            <View style={{ flex: 1, minWidth: 0 }}>
                              {m.teamB.map((pid) => (
                                <Pressable key={pid} style={[styles.playerTag, { justifyContent: 'flex-end' }]} onPress={() => openSwap(pid, round.index)} hitSlop={6}>
                                  <Ionicons name="pencil" size={9} color={colors.textFaint} style={styles.playerEditIcon} />
                                  <Text style={[styles.playerLine, { textAlign: 'right' }]} numberOfLines={1}>
                                    {shortName(playerName(event.players, pid))}
                                  </Text>
                                </Pressable>
                              ))}
                            </View>
                          </View>
                        </View>
                      );
                    })}

                    {!!round.sitOuts.length && (
                      <Text style={styles.sitOutText}>
                        {isTeamFormat(event.format) ? 'Bye this round: ' : 'Sitting out: '}
                        {round.sitOuts.map((id) => playerName(event.players, id)).join(', ')}
                      </Text>
                    )}
                  </View>
                );
              })}

              {event.status === 'live' && (
                <View style={styles.actionRow}>
                  <Pressable style={styles.actionBtn} onPress={onAddRounds}>
                    <Ionicons name="add-circle-outline" size={16} color={colors.lime} />
                    <Text style={styles.actionText}>Add rounds</Text>
                  </Pressable>
                  <Pressable style={styles.actionBtn} onPress={() => setAddPlayerVisible(true)}>
                    <Ionicons name="person-add-outline" size={16} color={colors.lime} />
                    <Text style={styles.actionText}>Add {entityWord}</Text>
                  </Pressable>
                </View>
              )}

              {event.status === 'live' && (
                <Pressable onPress={onEndEvent} style={styles.endEventRow}>
                  <Text style={styles.endEventText}>End event</Text>
                </Pressable>
              )}
              </ScrollView>
            )}

            {event.status === 'live' && (
              <View style={[styles.footer, styles.footerRow]}>
                <View style={{ flex: 1 }}>
                  <Button
                    label={isLastRound ? 'Finish event' : `End Round ${event.currentRoundIndex}`}
                    icon="chevron-forward"
                    onPress={onEndRound}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    label="Share live"
                    variant="secondary"
                    icon="share-social-outline"
                    iconPosition="left"
                    loading={shareBusy}
                    onPress={onShareLive}
                  />
                </View>
              </View>
            )}
            {event.status === 'done' && (
              <View style={styles.footer}>
                <View style={styles.footerRow}>
                  <View style={{ flex: 1 }}>
                    <Button
                      label="Share result card"
                      icon="share-social-outline"
                      iconPosition="left"
                      onPress={() => nav.navigate('ResultCard', { eventId: event.id })}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      label="Share live"
                      variant="secondary"
                      icon="share-social-outline"
                      iconPosition="left"
                      loading={shareBusy}
                      onPress={onShareLive}
                    />
                  </View>
                </View>
                <Pressable onPress={onReopenEvent} style={styles.endEventRow}>
                  <Text style={styles.endEventText}>Reopen event</Text>
                </Pressable>
              </View>
            )}
        </View>

        <View style={[styles.tabContent, tab !== 'standings' && styles.tabHidden]}>
            <Text style={styles.standingsRoundText}>
              {event.status === 'done' ? `Final · ${event.rounds.filter((r) => r.completed).length} rounds` : `Round ${event.currentRoundIndex} of ${event.totalRoundsEstimate}`}
            </Text>
            <View style={styles.sortRow}>
              <Text style={styles.sortLabel}>Sort by</Text>
              <SegmentedTabs
                size="sm"
                options={[
                  { key: 'points', label: 'Points' },
                  { key: 'wins', label: 'Wins' },
                ]}
                value={sortBy}
                onChange={(k) => setSortBy(k as 'points' | 'wins')}
              />
            </View>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, { width: 34 }]}>#</Text>
              <Text style={[styles.th, { flex: 1 }]}>Player</Text>
              <Text style={[styles.th, { width: 24, textAlign: 'center' }]}>P</Text>
              <Text style={[styles.th, { width: 24, textAlign: 'center' }]}>W</Text>
              <Text style={[styles.th, { width: 24, textAlign: 'center' }]}>T</Text>
              <Text style={[styles.th, { width: 24, textAlign: 'center' }]}>L</Text>
              <Text style={[styles.th, { width: 38, textAlign: 'center' }]}>PPM</Text>
              <Text style={[styles.th, { width: 40, textAlign: 'right' }]}>Pts</Text>
            </View>
            <ScrollView style={styles.scroll} contentContainerStyle={styles.standingsList}>
              {standings.map((s, i) => {
                const top = i < 3;
                const medal = ['#FFD34E', '#C9D6E5', '#E39A5B'][i];
                // Only the "Points" sort mode uses the league/wins/ties/losses tiebreak chain, so the
                // "why am I ranked here" explanation only applies to adjacent players tied on points then.
                const aboveNeighbor = i > 0 ? standings[i - 1] : null;
                const belowNeighbor = i < standings.length - 1 ? standings[i + 1] : null;
                const reasonAbove = sortBy === 'points' && aboveNeighbor ? describeTiebreak(s, aboveNeighbor, event.rounds) : null;
                const reasonBelow = sortBy === 'points' && belowNeighbor ? describeTiebreak(s, belowNeighbor, event.rounds) : null;
                const tiebreakEntries: TiebreakEntry[] = [
                  ...(reasonAbove && aboveNeighbor ? [{ neighborName: aboveNeighbor.player.name, reason: reasonAbove }] : []),
                  ...(reasonBelow && belowNeighbor ? [{ neighborName: belowNeighbor.player.name, reason: reasonBelow }] : []),
                ];
                return (
                  <View
                    key={s.player.id}
                    style={[
                      styles.standRow,
                      { borderColor: top ? 'rgba(198,234,59,.18)' : colors.white05, backgroundColor: top ? 'rgba(198,234,59,.06)' : colors.white05 },
                    ]}
                  >
                    <View style={{ width: 34, alignItems: 'center' }}>
                      <View style={[styles.rankBadge, { backgroundColor: top ? medal : colors.white06 }]}>
                        <Text style={[styles.rankText, { color: top ? colors.courtNavy : colors.textMuted }]}>{i + 1}</Text>
                      </View>
                    </View>
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9, minWidth: 0 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: s.player.gender === 'M' ? colors.male : colors.female }} />
                      <Text style={styles.standName} numberOfLines={1}>
                        {s.player.name}
                      </Text>
                      {s.player.benched && (
                        <View style={styles.benchMark}>
                          <Text style={styles.benchMarkText}>||</Text>
                        </View>
                      )}
                      {tiebreakEntries.length > 0 && (
                        <Pressable
                          hitSlop={8}
                          onPress={() => setTiebreakInfo({ playerName: s.player.name, points: s.points, entries: tiebreakEntries })}
                        >
                          <Ionicons name="alert-circle" size={14} color={colors.amber} />
                        </Pressable>
                      )}
                    </View>
                    <Text style={[styles.standCell, { width: 24, textAlign: 'center', color: colors.textMuted }]}>{s.played}</Text>
                    <Text style={[styles.standCell, { width: 24, textAlign: 'center', fontWeight: '700' }]}>{s.wins}</Text>
                    <Text style={[styles.standCell, { width: 24, textAlign: 'center', color: colors.textMuted }]}>{s.draws}</Text>
                    <Text style={[styles.standCell, { width: 24, textAlign: 'center', color: colors.textMuted }]}>{matchLosses(s)}</Text>
                    <Text style={[styles.standCell, { width: 38, textAlign: 'center', color: colors.textMuted, fontSize: 12 }]}>
                      {leaguePointsPerMatch(s).toFixed(2)}
                    </Text>
                    <Text style={[styles.standPts, { color: top ? colors.lime : colors.textPrimary }]}>{s.points}</Text>
                  </View>
                );
              })}
            </ScrollView>
            <View style={[styles.footer, styles.footerRow]}>
              <View style={{ flex: 1 }}>
                <Button
                  label="Share standings"
                  icon="share-social-outline"
                  iconPosition="left"
                  onPress={() => nav.navigate('ResultCard', { eventId: event.id, template: 'table' })}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  label="Share live"
                  variant="secondary"
                  icon="share-social-outline"
                  iconPosition="left"
                  loading={shareBusy}
                  onPress={onShareLive}
                />
              </View>
            </View>
        </View>

        <ScoreKeypad
          visible={!!edit}
          title={edit ? `${event.courts.find((c) => c.id === edit.courtId)?.name} · Team ${edit.team}` : ''}
          scoringMode={event.scoringMode}
          pot={event.pot}
          buffer={buffer}
          oppLabel={event.scoringMode === 'total' ? `Team ${edit?.team === 'A' ? 'B' : 'A'} auto-fills` : ''}
          onDigit={(d) => setBuffer((b) => (b + d).slice(0, 2))}
          onDelete={() => setBuffer((b) => b.slice(0, -1))}
          onConfirm={confirmScore}
          onClose={closeEdit}
          onClear={clearMatchScore}
        />

        <TiebreakInfoModal
          visible={!!tiebreakInfo}
          playerName={tiebreakInfo?.playerName ?? ''}
          points={tiebreakInfo?.points ?? 0}
          entries={tiebreakInfo?.entries ?? []}
          onClose={() => setTiebreakInfo(null)}
        />

        <AddPlayerModal
          visible={addPlayerVisible}
          regenerationText={regenerationText}
          showGender={!isTeamFormat(event.format)}
          onClose={() => setAddPlayerVisible(false)}
          onConfirm={onAddPlayer}
        />

        <PlayerPickerModal
          visible={!!swapOutgoing}
          title={`Replace ${swapOutgoing ? playerName(event.players, swapOutgoing.id) : entityWord}`}
          subtitle="They'll swap places from here on — completed rounds and current standings stay untouched, and total matches for each stay the same."
          items={swapCandidates}
          emptyText={`No other ${entityWord}s to swap in right now.`}
          onPick={confirmSwap}
          onClose={() => setSwapOutgoing(null)}
        />
      </SafeAreaView>
    </ScreenBackground>
  );
}

const makeStyles = (colors: ColorPalette) => StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingHorizontal: 22, paddingTop: 6 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 99, backgroundColor: colors.limeTint, borderWidth: 1, borderColor: colors.limeTintBorder },
  liveText: { fontSize: 12, fontWeight: '800', color: colors.lime, letterSpacing: 0.5 },
  endedPill: { backgroundColor: colors.white06, borderColor: colors.hairlineStrong },
  endedText: { color: colors.textMuted },
  syncPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6, paddingHorizontal: 11, borderRadius: 99, backgroundColor: colors.blueTint, borderWidth: 1, borderColor: colors.blueTintBorder },
  syncPillText: { fontSize: 12, fontWeight: '800', color: colors.blueText, letterSpacing: 0.3 },
  title: { marginTop: 14, fontSize: 23, fontWeight: '900', letterSpacing: -0.6, color: colors.textPrimary },
  meta: { fontSize: 13, color: colors.textMuted, fontWeight: '600', marginTop: 3 },
  tabsWrap: { paddingHorizontal: 22, paddingTop: 16 },
  tabContent: { flex: 1 },
  tabHidden: { display: 'none' },
  scroll: { flex: 1 },
  body: { padding: 20, paddingTop: 16, gap: 12, paddingBottom: 32 },
  roundBlock: { gap: 12, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.white05 },
  roundNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2, marginBottom: 4 },
  roundTitle: { fontSize: 18, fontWeight: '900', letterSpacing: -0.5, color: colors.textPrimary },
  roundOf: { fontSize: 12, color: colors.textFaint, fontWeight: '700' },
  courtCard: { backgroundColor: colors.surface, borderWidth: 1, borderRadius: 18, padding: 14 },
  courtCardIdle: { opacity: 0.6, borderStyle: 'dashed' },
  idleText: { fontSize: 13, color: colors.textFaint, textAlign: 'center', paddingVertical: 6 },
  courtTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 },
  courtName: { fontSize: 13, fontWeight: '800', color: colors.textPrimary },
  statusBadge: { paddingVertical: 3, paddingHorizontal: 9, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  matchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  playerTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  playerLine: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, flexShrink: 1 },
  playerEditIcon: { opacity: 0.6 },
  scoreBox: { width: 58, height: 58, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  scoreBoxShared: { borderStyle: 'dashed' },
  scoreText: { fontSize: 28, fontWeight: '800', fontVariant: ['tabular-nums'] },
  vs: { fontSize: 13, fontWeight: '800', color: colors.textFaint },
  sitOutText: { fontSize: 12, color: colors.textFaint, textAlign: 'center', marginTop: 4 },
  addPlayerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12 },
  addPlayerText: { color: colors.lime, fontWeight: '800', fontSize: 14 },
  actionRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 12, gap: 6 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  actionText: { color: colors.lime, fontWeight: '800', fontSize: 13 },
  endEventRow: { alignItems: 'center', paddingVertical: 8 },
  endEventText: { color: colors.textFaint, fontWeight: '700', fontSize: 13, textDecorationLine: 'underline' },
  footer: { paddingHorizontal: 22, paddingBottom: 24, paddingTop: 6 },
  footerRow: { flexDirection: 'row', gap: 10 },
  standingsRoundText: { paddingHorizontal: 22, paddingTop: 14, fontSize: 13, fontWeight: '700', color: colors.textMuted },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 22,
    marginTop: 10,
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 13,
    backgroundColor: colors.surfaceSunken,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  searchInput: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.textPrimary, padding: 0 },
  emptySearch: { textAlign: 'center', color: colors.textFaint, marginTop: 24, fontSize: 13, paddingHorizontal: 24 },
  playerHistoryCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  playerHistoryHead: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  playerHistoryName: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.white05,
  },
  historyRound: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase', color: colors.textFaint },
  historyMatchup: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginTop: 2 },
  historyScore: { fontSize: 15, fontWeight: '800', color: colors.textPrimary, fontVariant: ['tabular-nums'] },
  historyResult: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase', marginTop: 2 },
  sortRow: { paddingHorizontal: 22, paddingTop: 10, paddingBottom: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sortLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', color: colors.textFaint },
  tableHeader: { paddingHorizontal: 26, paddingTop: 8, paddingBottom: 6, flexDirection: 'row', alignItems: 'center' },
  th: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5, color: colors.textFaint, textTransform: 'uppercase' },
  standingsList: { paddingHorizontal: 16, paddingBottom: 24, gap: 6 },
  standRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 10, borderRadius: 13, borderWidth: 1 },
  rankBadge: { minWidth: 26, height: 26, paddingHorizontal: 5, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  rankText: { fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },
  standName: { fontWeight: '700', fontSize: 14, color: colors.textPrimary, flexShrink: 1 },
  benchMark: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 5, backgroundColor: colors.white06 },
  benchMarkText: { fontSize: 11, fontWeight: '900', color: colors.textFaint, letterSpacing: 0.5 },
  standCell: { fontSize: 14, fontVariant: ['tabular-nums'], color: colors.textPrimary },
  standPts: { width: 40, textAlign: 'right', fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
