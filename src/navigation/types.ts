export type RootStackParamList = {
  MainTabs: undefined;
  CreateName: undefined;
  CreateFormat: undefined;
  CreateScoring: undefined;
  CreateCourts: undefined;
  CreatePlayers: undefined;
  Dashboard: { eventId: string; tab?: 'rounds' | 'standings' };
  Knockout: { eventId: string };
  EditEvent: { eventId: string };
  ResultCard: { eventId: string; template?: 'list' | 'podium' | 'table' };
};

export type MainTabsParamList = {
  Events: undefined;
  Players: undefined;
  Results: undefined;
  Support: undefined;
};
