from django.db import migrations


LEGACY_DOCTOR_PROFILE_COLUMNS = {
    'availability',
    'email',
    'first_name',
    'is_active',
    'last_name',
    'phone',
}


def make_legacy_columns_nullable(apps, schema_editor):
    connection = schema_editor.connection
    if connection.vendor != 'mysql':
        return

    table_name = 'apibackendapp_doctorprofile'
    with connection.cursor() as cursor:
        cursor.execute(
            f'SHOW COLUMNS FROM {schema_editor.quote_name(table_name)}'
        )
        columns = {
            row[0]: (row[1], row[2])
            for row in cursor.fetchall()
        }

    for column_name in LEGACY_DOCTOR_PROFILE_COLUMNS:
        column = columns.get(column_name)
        if column is None:
            continue

        column_type, is_nullable = column
        if is_nullable == 'YES':
            continue

        schema_editor.execute(
            f'ALTER TABLE {schema_editor.quote_name(table_name)} '
            f'MODIFY COLUMN {schema_editor.quote_name(column_name)} '
            f'{column_type} NULL'
        )


class Migration(migrations.Migration):
    atomic = False

    dependencies = [
        ('apibackendapp', '0005_appointment_appointment_type_and_more'),
    ]

    operations = [
        migrations.RunPython(make_legacy_columns_nullable),
    ]
