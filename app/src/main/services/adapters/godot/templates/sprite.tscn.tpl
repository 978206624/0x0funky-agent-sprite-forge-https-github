[gd_scene load_steps=3 format=3 uid="{{UID}}"]

[ext_resource type="Texture2D" path="res://textures/{{SLUG}}-sheet.png" id="1_sheet"]
[ext_resource type="SpriteFrames" path="res://{{SLUG}}.tres" id="2_frames"]

[node name="Root" type="Node2D"]

[node name="Sprite" type="Sprite2D" parent="."]
texture = ExtResource("1_sheet")

[node name="AnimatedSprite" type="AnimatedSprite2D" parent="."]
sprite_frames = ExtResource("2_frames")
position = Vector2({{HALF_W}}, {{HALF_H}})
