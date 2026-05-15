#!/usr/bin/env python3
"""
Unit tests for scan detection in PDF extraction service
"""
import unittest
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from pdf_service import detect_scanned_pdf


class TestScanDetection(unittest.TestCase):
    """Test cases for detect_scanned_pdf function"""

    def test_empty_text_is_scanned(self):
        """Empty text should be detected as scanned"""
        self.assertTrue(detect_scanned_pdf("", 1))
        self.assertTrue(detect_scanned_pdf("   ", 1))

    def test_very_short_text_is_scanned(self):
        """Text under 200 chars should be detected as scanned"""
        short_text = "Invoice #123"  # 12 chars
        self.assertTrue(detect_scanned_pdf(short_text, 1))

    def test_low_chars_per_page_is_scanned(self):
        """Less than 100 chars/page on average should be detected as scanned"""
        # 150 chars total across 3 pages = 50 chars/page avg
        text = "A" * 150
        self.assertTrue(detect_scanned_pdf(text, 3))

    def test_normal_text_is_not_scanned(self):
        """Normal text with sufficient content should not be detected as scanned"""
        normal_text = "Invoice #12345\n" * 50  # ~750 chars
        self.assertFalse(detect_scanned_pdf(normal_text, 1))

    def test_multi_page_with_good_content(self):
        """Multi-page document with good text density is not scanned"""
        # 1000 chars across 5 pages = 200 chars/page
        text = "This is a sample invoice line item with description. " * 20
        self.assertFalse(detect_scanned_pdf(text, 5))

    def test_threshold_boundary(self):
        """Test at the exact threshold boundaries"""
        # Exactly 200 chars should NOT be scanned
        text_200 = "A" * 200
        self.assertFalse(detect_scanned_pdf(text_200, 1))

        # 199 chars should be scanned
        text_199 = "A" * 199
        self.assertTrue(detect_scanned_pdf(text_199, 1))

    def test_zero_pages(self):
        """Zero pages with text should not cause division by zero"""
        text = "A" * 500
        # Should not crash and return False (has content)
        self.assertFalse(detect_scanned_pdf(text, 0))


if __name__ == "__main__":
    unittest.main()
