"""Small deterministic baseline checks, with no external packages."""

import math
import unittest

from poker_math.decisions import call_chip_ev, required_equity


class PotOddsTests(unittest.TestCase):
    def test_one_quarter_equity_at_three_to_one_pot_odds(self):
        self.assertAlmostEqual(required_equity(25, 75), 0.25)

    def test_even_money_call(self):
        self.assertAlmostEqual(required_equity(100, 100), 0.5)

    def test_break_even_ev_is_zero(self):
        equity = required_equity(25, 75)
        self.assertAlmostEqual(call_chip_ev(equity, 25, 75), 0)

    def test_winning_certainly_gains_existing_pot(self):
        self.assertEqual(call_chip_ev(1, 25, 75), 75)

    def test_losing_certainly_loses_call_amount(self):
        self.assertEqual(call_chip_ev(0, 25, 75), -25)

    def test_positive_ev(self):
        self.assertAlmostEqual(call_chip_ev(0.3, 25, 75), 5)

    def test_invalid_financial_inputs(self):
        for call, pot in [(0, 100), (-1, 100), (1, -1), (math.inf, 1), (1, math.nan)]:
            with self.subTest(call=call, pot=pot):
                with self.assertRaises(ValueError):
                    required_equity(call, pot)

    def test_invalid_equity(self):
        for equity in [-0.01, 1.01, math.nan, math.inf]:
            with self.subTest(equity=equity):
                with self.assertRaises(ValueError):
                    call_chip_ev(equity, 25, 75)


if __name__ == "__main__":
    unittest.main()
