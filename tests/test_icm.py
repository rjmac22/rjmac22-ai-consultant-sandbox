"""Independent, exact checks of small-tournament ICM valuations."""

import unittest
from fractions import Fraction
from itertools import permutations

from poker_math.icm import icm_expected_payouts


class ICMTests(unittest.TestCase):
    def test_two_players_nonzero_second_prize(self):
        self.assertEqual(icm_expected_payouts([1, 3], [100, 40]), (Fraction(55), Fraction(85)))

    def test_equal_stacks_equal_expected_awards(self):
        self.assertEqual(icm_expected_payouts([1, 1, 1], [60, 30]), (Fraction(30),) * 3)

    def test_three_players_nontrivial_bubble(self):
        self.assertEqual(
            icm_expected_payouts([2, 1, 1], [100, 50]),
            (Fraction(200, 3), Fraction(125, 3), Fraction(125, 3)),
        )

    def test_winner_take_all_matches_chip_shares(self):
        stacks = [5, 3, 2, 1]
        self.assertEqual(
            icm_expected_payouts(stacks, [110]),
            tuple(Fraction(110 * chips, sum(stacks)) for chips in stacks),
        )

    def test_total_awards_conserved(self):
        scenarios = [([3, 1], [10]), ([3, 2, 1], [90, 30, 10]), ([5, 4, 3, 2], [100, 50])]
        for stacks, prizes in scenarios:
            with self.subTest(stacks=stacks, prizes=prizes):
                self.assertEqual(sum(icm_expected_payouts(stacks, prizes)), sum(prizes))

    def test_scaling_chip_stacks_does_not_change_results(self):
        self.assertEqual(
            icm_expected_payouts([2, 3, 5], [90, 20]),
            icm_expected_payouts([200, 300, 500], [90, 20]),
        )

    def test_permuting_seat_order_only_permutes_outputs(self):
        stacks, prizes = [3, 2, 1], [100, 40]
        original = icm_expected_payouts(stacks, prizes)
        for positions in permutations(range(3)):
            with self.subTest(positions=positions):
                self.assertEqual(
                    icm_expected_payouts([stacks[i] for i in positions], prizes),
                    tuple(original[i] for i in positions),
                )

    def test_rejects_invalid_player_counts(self):
        for stacks in ([], [1], [1] * 7):
            with self.subTest(stacks=stacks), self.assertRaises(ValueError):
                icm_expected_payouts(stacks, [100])

    def test_rejects_zero_negative_fractional_boolean_stacks(self):
        for stacks in ([0, 1], [-2, 3], [1.5, 3], [True, 3]):
            with self.subTest(stacks=stacks), self.assertRaises(ValueError):
                icm_expected_payouts(stacks, [100])

    def test_rejects_invalid_prizes(self):
        for prizes in ([], [50, 60], [-1], [True, 0], [100, 50, 20]):
            with self.subTest(prizes=prizes), self.assertRaises(ValueError):
                icm_expected_payouts([3, 2], prizes)


if __name__ == "__main__":
    unittest.main()
