"""Replaceable internal file gateway. The CSV contract here is demonstrative, not RBC's."""

import csv
import io
from typing import Protocol


class RBCGateway(Protocol):
    """Extension point for RBC file exchange or a future API adapter."""

    def export_accruals(self, rows) -> bytes: ...

    def parse_payment_registry(self, data: bytes): ...


class InternalCSVGateway:
    """Internal demo CSV only; this is not an official RBC file format."""
    def export_accruals(self, rows) -> bytes:
        output = io.StringIO(newline="")
        writer = csv.writer(output, delimiter=";", lineterminator="\n")
        writer.writerow(
            [
                "personal_account",
                "invoice_id",
                "billing_period",
                "service_code",
                "amount",
                "currency",
            ]
        )
        for account, invoice, item in rows:
            writer.writerow(
                [
                    account.account_number,
                    invoice.id,
                    invoice.billing_period.isoformat(),
                    item.service_code,
                    f"{item.amount // 100}.{item.amount % 100:02d}",
                    invoice.currency,
                ]
            )
        return output.getvalue().encode("utf-8-sig")

    @staticmethod
    def parse_payment_registry(data: bytes):
        text = data.decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(text, newline=""), delimiter=";")
        required = {
            "invoice_id",
            "external_payment_id",
            "amount",
            "status",
            "confirmed_at",
        }
        if not reader.fieldnames or set(reader.fieldnames) != required:
            raise ValueError(
                "Expected internal demo CSV columns: " + ";".join(sorted(required))
            )
        return list(reader)


# Backward-compatible name for existing imports.
BillingGateway = InternalCSVGateway
