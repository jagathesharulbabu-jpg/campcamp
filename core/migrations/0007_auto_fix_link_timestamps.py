from django.db import migrations
from datetime import timedelta


def fix_link_timestamps(apps, schema_editor):
    PopupLink = apps.get_model('core', 'PopupLink')
    for link in PopupLink.objects.all():
        # If link was saved with UTC morning time (between 07:00 and 08:59) due to the previous datetime-local UTC bug
        if link.inserted_at and link.inserted_at.hour in (7, 8):
            link.inserted_at = link.inserted_at + timedelta(hours=5, minutes=30)
            link.save(update_fields=['inserted_at'])


def reverse_fix(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ('core', '0006_revocallscall_alter_country_name'),
    ]

    operations = [
        migrations.RunPython(fix_link_timestamps, reverse_fix),
    ]
