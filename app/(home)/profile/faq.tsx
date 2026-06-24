import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { LayoutAnimation, Platform, ScrollView, Text, TouchableOpacity, UIManager, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BackButton from '../../../components/BackButton';
import { radii, spacing } from '../../../constants/theme';
import { makeStyles, useTheme } from '../../../lib/theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Original Bettrr FAQ. Money / classification answers are intentionally written
// without legal conclusions — those two must be reviewed by counsel before launch.
type QA = { q: string; a: string };
const FAQ: QA[] = [
  {
    q: 'How does Bettrr work?',
    a: 'Pick a goal, put a stake on it, then record short video proof on the days the challenge requires. Finish the challenge and you split the pot with everyone else who finished. Fall short and your stake stays in the pot for the people who made it.',
  },
  {
    q: 'How is my proof checked?',
    a: 'Every clip goes through three layers. AI screens it first — counting reps and looking for signs of tampering — and clean clips are approved automatically. Your accountability group of a few other players can flag anything that looks off. Flagged clips go to a neutral reviewer who isn’t in your group and doesn’t know you.',
  },
  {
    q: 'Why do I have to record inside the app?',
    a: 'Proof is filmed live in Bettrr — never uploaded from your camera roll. While you record, a code that rotates every day is shown on screen, so old clips or downloaded videos can’t be passed off as today’s.',
  },
  {
    q: 'What happens if I miss a day?',
    a: 'Each challenge can allow a set number of missed days. Stay within that and you’re still in. Go past it and you’re out — your stake remains in the pot for the finishers.',
  },
  {
    q: 'Who gets the forfeited stakes?',
    a: 'The pot — every player’s stake, minus any creator fee — is split evenly among everyone who completes the challenge. The more people fall short, the bigger each finisher’s share.',
  },
  {
    q: 'Can the challenge creator take a cut?',
    a: 'Creators of public challenges can set a fee of up to 10% of the pot. The fee is always shown before you join, so you know exactly what share goes to winners.',
  },
  {
    q: 'What if I get flagged unfairly?',
    a: 'A flag is not a verdict — it only sends your clip to a neutral reviewer for a fresh look. Players who flag honestly build reputation over time; players who abuse flags have their flags counted for less.',
  },
  {
    q: 'What are points, and is real money involved?',
    a: 'You play challenges using points. Whether points can be purchased or converted to cash, and where that’s offered, depends on the rules in your region — so what’s available may differ from place to place.',
  },
  {
    q: 'Is this gambling?',
    a: 'Bettrr is built around skill and effort: whether you finish is up to you, not chance. How challenges that involve a stake are classified can vary by where you live, so availability may differ by region.',
  },
];

export default function FaqScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const [open, setOpen] = useState<number | null>(0);

  const toggle = (i: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((cur) => (cur === i ? null : i));
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="auto" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <BackButton />
        <Text style={styles.title}>Help & FAQ</Text>
        <Text style={styles.subtitle}>How challenges, proof, and the pot work.</Text>

        <View style={styles.list}>
          {FAQ.map((item, i) => {
            const expanded = open === i;
            return (
              <View key={item.q} style={[styles.item, expanded && styles.itemOpen]}>
                <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={() => toggle(i)}>
                  <Text style={styles.q}>{item.q}</Text>
                  <Ionicons
                    name={expanded ? 'remove' : 'add'}
                    size={20}
                    color={expanded ? colors.accent : colors.textDim}
                  />
                </TouchableOpacity>
                {expanded && <Text style={styles.a}>{item.a}</Text>}
              </View>
            );
          })}
        </View>

        <View style={styles.contactCard}>
          <Text style={styles.contactTitle}>Still stuck?</Text>
          <Text style={styles.contactText}>
            Reach the team at help@bettrr.app and we’ll get back to you.
          </Text>
        </View>
        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  safe: { flex: 1, backgroundColor: colors.bgPage },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xl },
  title: { fontSize: 26, fontWeight: '900', color: colors.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: colors.textDim, marginTop: 4, marginBottom: spacing.lg },

  list: { gap: spacing.sm },
  item: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderMid,
    paddingHorizontal: spacing.md,
  },
  itemOpen: { borderColor: colors.accentBorder },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15, gap: spacing.md },
  q: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.textPrimary, lineHeight: 19 },
  a: { fontSize: 13, color: colors.textSecondary, lineHeight: 20, paddingBottom: spacing.md, paddingRight: spacing.sm },

  contactCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.cardInner,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.lg,
  },
  contactTitle: { fontSize: 14, fontWeight: '800', color: colors.textPrimary, marginBottom: 4 },
  contactText: { fontSize: 12, color: colors.textDim, lineHeight: 17 },
}));
