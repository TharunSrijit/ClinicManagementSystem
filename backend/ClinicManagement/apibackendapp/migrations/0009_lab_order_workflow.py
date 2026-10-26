from django.db import migrations, models


def backfill_order_numbers(apps, schema_editor):
    """Give a proper LAB000xx number to any old order saved with a blank one."""
    LabTestOrder = apps.get_model("apibackendapp", "LabTestOrder")
    for order in LabTestOrder.objects.filter(order_number=""):
        order.order_number = f"LAB{order.id:05d}"
        order.save(update_fields=["order_number"])


class Migration(migrations.Migration):

    dependencies = [
        ("apibackendapp", "0008_alter_appointment_status"),
    ]

    operations = [
        migrations.AddField(
            model_name="labtestorder",
            name="completed_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name="labtestorder",
            name="order_number",
            field=models.CharField(blank=True, max_length=30, unique=True),
        ),
        migrations.AlterField(
            model_name="labtestorder",
            name="status",
            field=models.CharField(
                choices=[
                    ("ORDERED", "Requested by Doctor"),
                    ("PAYMENT_PENDING", "Awaiting Payment"),
                    ("PAID", "Paid - Ready for Sample"),
                    ("SAMPLE_COLLECTED", "Sample Collected"),
                    ("PROCESSING", "Processing"),
                    ("COMPLETED", "Completed - Sent to Doctor"),
                    ("CANCELLED", "Cancelled"),
                ],
                default="ORDERED",
                max_length=30,
            ),
        ),
        migrations.RunPython(backfill_order_numbers, migrations.RunPython.noop),
    ]