"""Boundary checks for the multi-card probability helper."""

import unittest

from poker_math.draws import probability_at_least_one_out


class DrawProbabilityTests(unittest.TestCase):
    def test_one_card(self):
        self.assertAlmostEqual(probability_at_least_one_out(9, 47, 1), 9 / 47)

    def test_no_outs(self):
        self.assertEqual(probability_at_least_one_out(0, 47, 2), 0)

    def test_all_cards_are_outs(self):
        self.assertEqual(probability_at_least_one_out(47, 47, 2), 1)

    def test_additional_card_cannot_reduce_probability(self):
        self.assertGreaterEqual(
            probability_at_least_one_out(9, 47, 2),
            probability_at_least_one_out(9, 47, 1),
        )

    def test_reject_bad_counts(self):
        for args in [(-1, 47, 2), (48, 47, 2), (9, 47, 48), (9, 0, 1)]:
            with self.subTest(args=args):
                with self.assertRaises(ValueError):
                    probability_at_least_one_out(*args)


if __name__ == "__main__":
    unittest.main()
