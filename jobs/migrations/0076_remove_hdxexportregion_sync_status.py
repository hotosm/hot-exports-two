# -*- coding: utf-8 -*-
# Generated by Django 1.11.3 on 2022-12-01 12:20
from __future__ import unicode_literals

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('jobs', '0075_hdxexportregion_sync_status'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='hdxexportregion',
            name='sync_status',
        ),
    ]
