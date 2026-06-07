<?php
/*
Plugin Name: AgentShield Observer
Plugin URI: https://agentshield.ai
Description: AgentShield traffic observer plugin.
Version: 0.1.0
Author: AgentShield
*/

if (!defined('ABSPATH')) {
    exit;
}

function agentshield_enqueue_tracker() {
    wp_enqueue_script(
        'agentshield-tracker',
        plugin_dir_url(__FILE__) . 'assets/tracker.js',
        [],
        '0.1.0',
        true
    );
}

add_action(
    'wp_enqueue_scripts',
    'agentshield_enqueue_tracker'
);
